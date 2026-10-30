/**
 * Exporta a JSON todos los datos que necesitan los manuales: las 20 consultas de MongoDB y las 6 de Cypher (con su código
 * y sus resultados reales), las cifras de carga, los documentos de ejemplo y las series para las gráficas del análisis.
 * Lo consume docs/generador/, que arma el .docx. Así las cifras del manual salen de las bases y no se escriben a mano.
 *
 * Uso: npm run exportar:manual      (requiere MongoDB y Neo4j encendidos y con los datos cargados)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cerrarMongo, getDb } from '../src/config/mongo';
import { cerrarNeo4j } from '../src/config/neo4j';
import { ejecutarConsulta } from '../src/modules/analytics/analytics.service';
import { CONSULTAS } from '../src/modules/analytics/queries';
import { CONSULTAS_CYPHER } from '../src/modules/graph/cypher';
import { ejecutarConsultaCypher, mapaDemanda, redAspirante, resumenGrafo } from '../src/modules/graph/graph.service';
import { formatear } from './lib/doc';

async function main() {
  const db = await getDb();

  // Aspirante de ejemplo: habilitado, con dos años de participación (el mismo que usa la documentación de consultas)
  const ejemplo = await db.collection('aspirantes').find({ 'anios_ingreso.1': { $exists: true }, habilitacion: { $ne: null } }).sort({ _id: 1 }).limit(1).next();
  const aspirante_id = String(ejemplo?._id ?? '');

  const consultasMongo = [];
  for (const c of CONSULTAS) {
    const entrada = c.parametros.some((p) => p.nombre === 'aspirante_id') ? { aspirante_id } : {};
    const r = await ejecutarConsulta(c.id, entrada);
    consultasMongo.push({
      tipo: 'mongo', id: c.id, numero: c.numero, titulo: c.titulo, descripcion: c.descripcion, explicacion: c.explicacion,
      coleccion: c.coleccion, grafica: c.grafica, parametros: r.consulta.parametros,
      codigo: `db.${c.coleccion}.aggregate(${formatear(r.pipeline)})`, filas: r.filas, total_filas: r.total_filas, duracion_ms: r.duracion_ms,
    });
  }

  const consultasCypher = [];
  for (const c of CONSULTAS_CYPHER) {
    const r = await ejecutarConsultaCypher(c.id, {});
    consultasCypher.push({
      tipo: 'cypher', id: c.id, numero: c.numero, titulo: c.titulo, descripcion: c.descripcion, explicacion: c.explicacion,
      demuestra: c.demuestra, grafica: c.grafica, parametros: c.parametros, codigo: c.cypher, filas: r.filas, total_filas: r.total_filas, duracion_ms: r.duracion_ms,
    });
  }

  // Cifras generales y de carga
  const E = db.collection('evaluaciones');
  const P = db.collection('postulaciones');
  const cargas = await db.collection('cargas').find({}, { projection: { _id: 0, archivo: 1, leidos: 1, cargados: 1, rechazados: 1, omitidos: 1, duracion_ms: 1, estado: 1, rechazos_por_causa: 1 } }).sort({ archivo: 1 }).toArray();
  const advertencias = await E.aggregate([{ $unwind: '$advertencias' }, { $group: { _id: '$advertencias', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
  const porAnio = await P.aggregate([
    { $group: { _id: '$anio_ingreso', postulaciones: { $sum: 1 }, aprobados_c: { $sum: { $cond: ['$aprobado', 1, 0] } }, aprobados_a: { $sum: { $cond: ['$aprobo_ambas_en_el_anio', 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  const evalPorAnioMateria = await E.aggregate([
    { $group: { _id: { anio: '$anio_ingreso', materia: '$materia' }, n: { $sum: 1 }, aprobadas: { $sum: { $cond: ['$aprobada', 1, 0] } } } },
    { $sort: { '_id.anio': 1 } },
  ]).toArray();
  const estados = await P.aggregate([{ $group: { _id: '$estado', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
  const mecanica = await P.aggregate([
    { $unwind: '$carreras' },
    { $match: { carreras: { $regex: '^INGENIERIA MECANICA' } } },
    { $group: { _id: { anio: '$anio_ingreso', carrera: '$carreras' }, n: { $sum: 1 } } },
    { $sort: { '_id.anio': 1 } },
  ]).toArray();
  const sinCarreraPorAnio = await P.aggregate([{ $match: { carreras: { $size: 0 } } }, { $group: { _id: '$anio_ingreso', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray();
  const sexo = await db.collection('aspirantes').aggregate([{ $group: { _id: '$sexo', n: { $sum: 1 } } }]).toArray();

  const general = {
    evaluaciones: await E.countDocuments(), postulaciones: await P.countDocuments(), aspirantes: await db.collection('aspirantes').countDocuments(),
    rechazados: await db.collection('rechazados').countDocuments(), resumen_carrera: await db.collection('resumen_carrera').countDocuments(),
    cargas: await db.collection('cargas').countDocuments(),
    edad_promedio: (await P.aggregate([{ $match: { edad: { $ne: null } } }, { $group: { _id: null, m: { $avg: '$edad' } } }]).toArray())[0]?.m,
    sin_edad: await P.countDocuments({ edad: null }), sin_carrera: await P.countDocuments({ carreras: { $size: 0 } }),
  };

  // Documentos reales de ejemplo para el capítulo del modelo de MongoDB
  const ejemplos = {
    evaluacion: await E.findOne({ _id: '2015|949d241ac10256edf113|1|MATEMATICA' as never }),
    postulacion: await P.findOne({ aspirante_id: aspirante_id, aprobado: true } as never),
    aspirante: await db.collection('aspirantes').findOne({ _id: aspirante_id as never }),
    aspirante_id,
  };

  const mapa = await mapaDemanda({});
  const mapaFiltrado = await mapaDemanda({ departamento: 'QUETZALTENANGO', anio_ingreso: '2019', solo_aprobados: 'si' });
  const red = await redAspirante(aspirante_id);
  const neo4j = await resumenGrafo();

  const salida = {
    generado_en: new Date().toISOString(), consultasMongo, consultasCypher, general, cargas, advertencias, porAnio, evalPorAnioMateria, estados,
    mecanica, sinCarreraPorAnio, sexo, ejemplos, neo4j,
    grafos: {
      mapa: { nodos: mapa.grafo.nodos.length, aristas: mapa.grafo.aristas.length },
      mapaFiltrado: { nodos: mapaFiltrado.grafo.nodos.length, aristas: mapaFiltrado.grafo.aristas.length },
      red: { nodos: red.grafo.nodos.length, aristas: red.grafo.aristas.length },
    },
  };
  const destino = path.resolve(__dirname, '../../docs/generador/datos/datos.json');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(salida, null, 1), 'utf-8');
  console.log(`Datos exportados: ${consultasMongo.length} consultas de MongoDB, ${consultasCypher.length} de Cypher -> ${destino}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
  });
