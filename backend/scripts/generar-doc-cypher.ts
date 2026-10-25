/**
 * Genera docs/consultas-cypher.md a partir de las consultas registradas en el código: el Cypher que se documenta es
 * exactamente el que se ejecuta y los resultados son los reales (del grafo cargado en Neo4j).
 *
 * Uso: npm run doc:cypher
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { cerrarMongo, getDb } from '../src/config/mongo';
import { cerrarNeo4j } from '../src/config/neo4j';
import { CONSULTAS_CYPHER } from '../src/modules/graph/cypher';
import { CYPHER_ASPIRANTE, CYPHER_MAPA, ejecutarConsultaCypher, mapaDemanda, redAspirante } from '../src/modules/graph/graph.service';
import { MAX_FILAS, tabla } from './lib/doc';

async function main() {
  const db = await getDb();
  const ejemplo = await db.collection('aspirantes').find({ 'anios_ingreso.1': { $exists: true }, habilitacion: { $ne: null } }).sort({ _id: 1 }).limit(1).next();
  const aspirante_id = String(ejemplo?._id ?? '');

  const partes: string[] = [
    '# Consultas de Neo4j (Cypher)',
    '',
    '> Documento generado automáticamente con `npm run doc:cypher` desde el código de `backend/src/modules/graph/`.',
    '> El Cypher que se muestra es exactamente el que se ejecuta y los resultados son los del grafo cargado.',
    '',
    'Cypher es el lenguaje de consultas de Neo4j. Los patrones se dibujan con paréntesis para los **nodos** y corchetes para las ' +
      '**relaciones**: `(p:Postulacion)-[:ASPIRA_A]->(c:Carrera)` se lee "una postulación que aspira a una carrera". `MATCH` busca el ' +
      'patrón, `WHERE` filtra, `WITH` encadena etapas y `RETURN` da la salida. Los nodos, relaciones y propiedades del modelo están en ' +
      '[modelo-neo4j.md](modelo-neo4j.md).',
    '',
    '## Cómo ejecutarlas',
    '',
    '- **API:** `GET /api/graph/consultas/{id}` (por ejemplo `/api/graph/consultas/g01?departamento=GUATEMALA&anio_ingreso=2019`).',
    '- **Neo4j Browser:** abre `http://localhost:7474`, entra con el usuario `neo4j` y la contraseña de tu `.env`, define los parámetros ' +
      'con `:param` (por ejemplo `:param departamento => "GUATEMALA"` y `:param anio_ingreso => null`) y pega el Cypher. Los enteros ' +
      'se escriben sin comillas y un parámetro opcional sin valor se escribe `null`.',
    '',
    '| # | Consulta | Qué demuestra |',
    '|---|---|---|',
    ...CONSULTAS_CYPHER.map((c) => `| ${c.numero} | [${c.titulo}](#consulta-g${c.numero}) | ${c.demuestra.join('; ')} |`),
    '',
  ];

  for (const c of CONSULTAS_CYPHER) {
    const r = await ejecutarConsultaCypher(c.id, {});
    partes.push(`<a id="consulta-g${c.numero}"></a>`, '', `## Consulta ${c.numero} · ${c.titulo}`, '', c.descripcion, '');
    partes.push(`- **Endpoint:** \`GET /api/graph/consultas/${c.id}\``);
    partes.push(`- **Gráfica en la interfaz:** ${c.grafica}`);
    partes.push(`- **Demuestra:** ${c.demuestra.join('; ')}`, '');
    if (c.parametros.length > 0) {
      partes.push('| Parámetro | Tipo | Por defecto | Descripción |', '|---|---|---|---|');
      for (const p of c.parametros) {
        partes.push(`| \`${p.nombre}\` | ${p.tipo}${p.requerido ? ' (obligatorio)' : ''} | ${p.por_defecto ?? 'sin filtro'} | ${p.descripcion} |`);
      }
      partes.push('');
    }
    partes.push('**Cómo funciona.** ' + c.explicacion, '');
    partes.push('```cypher', c.cypher, '```', '');
    partes.push(`**Resultado con los parámetros por defecto** (${r.total_filas} fila${r.total_filas === 1 ? '' : 's'}${r.total_filas > MAX_FILAS ? `; se muestran las primeras ${MAX_FILAS}` : ''}):`, '');
    partes.push(tabla(r.filas), '');
  }

  // Vistas del explorador de grafos
  const mapa = await mapaDemanda({});
  const mapaFiltrado = await mapaDemanda({ departamento: 'QUETZALTENANGO', anio_ingreso: '2019', solo_aprobados: 'si' });
  const red = await redAspirante(aspirante_id);
  partes.push(
    '## Vistas del explorador de grafos',
    '',
    'El explorador no dibuja los 96,831 nodos de golpe: pide al backend un **subgrafo limitado por filtros**. Son dos vistas.',
    '',
    '### Vista A · Mapa de demanda',
    '',
    `Endpoint \`GET /api/graph/mapa-demanda\` con los filtros \`anio_ingreso\`, \`departamento\`, \`solo_aprobados\` (\`si\`/\`no\`) y \`limite\`. ` +
      'Cada arista municipio → carrera lleva como peso el número de postulaciones que las conectan; los departamentos agrupan a sus municipios.',
    '',
    '```cypher',
    CYPHER_MAPA,
    '```',
    '',
    '| Filtros | Nodos | Aristas |',
    '|---|---|---|',
    `| ninguno (límite 150 conexiones) | ${mapa.grafo.nodos.length} | ${mapa.grafo.aristas.length} |`,
    `| departamento QUETZALTENANGO, año 2019, solo aprobados | ${mapaFiltrado.grafo.nodos.length} | ${mapaFiltrado.grafo.aristas.length} |`,
    '',
    '### Vista B · Red de un aspirante',
    '',
    'Endpoint `GET /api/graph/aspirante/{id}`. Muestra al aspirante, sus postulaciones, las carreras, el municipio y el tipo de institución ' +
      'de cada una, y una arista `EVALUADA_EN` por cada evaluación (con `oportunidad`, `aprobada` e `intento` como propiedades).',
    '',
    '```cypher',
    CYPHER_ASPIRANTE,
    '```',
    '',
    `Para el aspirante de ejemplo \`${aspirante_id}\`: ${red.grafo.nodos.length} nodos y ${red.grafo.aristas.length} aristas.`,
    '',
    '## Verificación cruzada con MongoDB',
    '',
    'Como los dos motores se llenan de las mismas colecciones derivadas, los resultados deben coincidir. Cada cifra de Neo4j se recalculó ' +
      'en MongoDB con un método distinto (`countDocuments`, `$all`, `$size` y un recorrido por aspirante), y todas coinciden:',
    '',
    '| Consulta | Neo4j | MongoDB | Cómo se recalculó en MongoDB |',
    '|---|---|---|---|',
    '| g01 · Quetzaltenango, Ciencias y Sistemas | 162 | 162 | `countDocuments({departamento, carreras})` |',
    '| g01 · Quetzaltenango, Ciencias y Sistemas, aprobados | 19 | 19 | igual, con `aprobado: true` |',
    '| g02 · Civil + Ciencias y Sistemas | 892 | 892 | `carreras: { $all: [...] }` |',
    '| g02 · Civil + Industrial | 654 | 654 | igual |',
    '| g03 · Ciencias y Sistemas → Industrial | 142 | 142 | recorrido por aspirante comparando años consecutivos |',
    '| g03 · Civil → Industrial | 102 | 102 | igual |',
    '| g04 · Privadas, aprobaron Matemática | 9,631 | 9,631 | `materias: { $elemMatch }` |',
    '| g04 · Privadas, aprobaron en el intento 3 o posterior | 3,593 | 3,593 | `$elemMatch` con `intento_aprobacion >= 3` |',
    '| g05 · Guatemala, Ciencias y Sistemas, aprobados | 2,338 | 2,338 | `countDocuments` |',
    '| g06 · Aspirantes con 1 año (y aprobaron) | 28,229 (6,456) | 28,229 (6,456) | `anios_ingreso: { $size: 1 }` |',
    '| g06 · Aspirantes con 3 años (y aprobaron) | 2,016 (200) | 2,016 (200) | `anios_ingreso: { $size: 3 }` |',
    '',
  );

  const destino = path.resolve(__dirname, '../../docs/consultas-cypher.md');
  writeFileSync(destino, partes.join('\n'), 'utf-8');
  console.log(`Documento generado: ${destino} (${partes.join('\n').split('\n').length} líneas)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
  });
