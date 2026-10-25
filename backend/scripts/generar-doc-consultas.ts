/**
 * Genera docs/consultas-mongodb.md a partir de las 20 consultas registradas en el código: el pipeline que se
 * documenta es exactamente el que se ejecuta y los resultados son los reales (de las colecciones cargadas).
 *
 * Uso: npm run doc:consultas
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { Document } from 'mongodb';
import { cerrarMongo, getDb } from '../src/config/mongo';
import { ejecutarConsulta } from '../src/modules/analytics/analytics.service';
import { CONSULTAS } from '../src/modules/analytics/queries';
import { MAX_FILAS, formatear, tabla } from './lib/doc';

const jsonPipeline = (pipeline: Document[]): string => formatear(pipeline);

async function main() {
  const db = await getDb();
  // Aspirante de ejemplo para las consultas 11 y 15: habilitado y con más de un año de participación
  const ejemplo = await db.collection('aspirantes').find({ 'anios_ingreso.1': { $exists: true }, habilitacion: { $ne: null } }).sort({ _id: 1 }).limit(1).next();
  const aspirante_id = String(ejemplo?._id ?? '');

  const partes: string[] = [
    '# Consultas de MongoDB',
    '',
    '> Documento generado automáticamente con `npm run doc:consultas` desde el código de `backend/src/modules/analytics/queries/`.',
    '> El pipeline que se muestra es exactamente el que se ejecuta y los resultados son los de la base cargada.',
    '',
    'Las 20 consultas usan el **pipeline de agregación** de MongoDB: una cadena de etapas (`$match` filtra, `$unwind` ' +
      'convierte un arreglo en una fila por elemento, `$group` agrupa y calcula, `$sort` ordena, `$project` da forma a la salida) ' +
      'en la que cada etapa recibe el resultado de la anterior.',
    '',
    'Las definiciones de "aprobado", "primer intento" y la unidad de conteo de cada consulta están en [reglas-etl.md](reglas-etl.md) ' +
      'y las colecciones en [modelo-mongodb.md](modelo-mongodb.md).',
    '',
    '## Cómo ejecutarlas',
    '',
    '- **API:** `GET /api/analytics/consultas/{id}` (por ejemplo `/api/analytics/consultas/q10?edad_min=16&edad_max=18`). ' +
      'Los parámetros opcionales van en la URL; casi todas aceptan `anio_ingreso`. La respuesta incluye las filas y el pipeline usado.',
    '- **MongoDB Compass:** conéctate a `mongodb://localhost:27017`, abre la base `admision_usac`, entra a la colección indicada, ' +
      'pestaña **Aggregations**, cambia a modo **Text** y pega el arreglo del pipeline.',
    '- **Terminal:** `db.<colección>.aggregate(<pipeline>)` en `mongosh`.',
    '',
    '| # | Consulta | Colección | Gráfica |',
    '|---|---|---|---|',
    ...CONSULTAS.map((c) => `| ${c.numero} | [${c.titulo}](#consulta-${c.numero}) | \`${c.coleccion}\` | ${c.grafica} |`),
    '',
  ];

  for (const c of CONSULTAS) {
    const entrada = c.parametros.some((p) => p.nombre === 'aspirante_id') ? { aspirante_id } : {};
    const r = await ejecutarConsulta(c.id, entrada);
    const params = r.consulta.parametros;

    partes.push(`<a id="consulta-${c.numero}"></a>`, '', `## Consulta ${c.numero} · ${c.titulo}`, '');
    partes.push(c.descripcion, '');
    partes.push(`- **Colección:** \`${c.coleccion}\``);
    partes.push(`- **Gráfica en la interfaz:** ${c.grafica}`);
    partes.push(`- **Endpoint:** \`GET /api/analytics/consultas/${c.id}\``, '');
    if (params.length > 0) {
      partes.push('| Parámetro | Tipo | Por defecto | Descripción |', '|---|---|---|---|');
      for (const p of params) {
        partes.push(`| \`${p.nombre}\` | ${p.tipo}${p.requerido ? ' (obligatorio)' : ''} | ${p.por_defecto ?? '—'} | ${p.descripcion} |`);
      }
      partes.push('');
    }
    partes.push('**Cómo funciona.** ' + c.explicacion, '');
    partes.push('```js', `db.${c.coleccion}.aggregate(${jsonPipeline(r.pipeline)})`, '```', '');

    partes.push(`**Resultado** (${r.total_filas} fila${r.total_filas === 1 ? '' : 's'}${r.total_filas > MAX_FILAS ? `; se muestran las primeras ${MAX_FILAS}` : ''}${
      c.id === 'q11' || c.id === 'q15' ? `; aspirante de ejemplo \`${aspirante_id}\`` : ''
    }):`, '');
    if (c.grafica === 'detalle') {
      const doc = { ...r.filas[0] } as Document;
      delete doc.historial;
      doc.postulaciones = (doc.postulaciones as Document[]).map((p) => ({
        anio_ingreso: p.anio_ingreso,
        estado: p.estado,
        carreras: p.carreras,
        n_evaluaciones: p.n_evaluaciones,
      }));
      partes.push('```json', JSON.stringify(doc, null, 2), '```', '');
      partes.push('_(El campo `historial`, con todas las evaluaciones, se omite aquí por extensión.)_', '');
    } else {
      partes.push(tabla(r.filas), '');
    }
  }

  const destino = path.resolve(__dirname, '../../docs/consultas-mongodb.md');
  writeFileSync(destino, partes.join('\n'), 'utf-8');
  console.log(`Documento generado: ${destino} (${partes.join('\n').split('\n').length} líneas)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => cerrarMongo());
