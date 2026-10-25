import { Db, Document } from 'mongodb';
import { ConsultaMongo } from '../analytics.types';

/**
 * Consulta 6: crear la colección auxiliar `resumen_carrera` con un resumen por carrera.
 *
 * Etapas del pipeline sobre `postulaciones`:
 *  1. $match + $unwind: una fila por (postulación, carrera). Una postulación con dos carreras cuenta en ambas (R-C8).
 *  2. $group por (carrera, año): cuenta postulaciones, aprobados y acumula edades.
 *  3. $group por carrera: junta los años y suma.
 *  4. $project: calcula tasas y promedios.
 *  5. $merge: escribe el resultado en la colección `resumen_carrera` (reemplaza lo que ya hubiera).
 */
export const pipelineResumenCarrera: Document[] = [
  { $match: { 'carreras.0': { $exists: true } } },
  { $unwind: '$carreras' },
  {
    $group: {
      _id: { carrera: '$carreras', anio: '$anio_ingreso' },
      postulaciones: { $sum: 1 },
      aspirantes: { $addToSet: '$aspirante_id' },
      aprobados: { $sum: { $cond: ['$aprobado', 1, 0] } },
      aprobados_en_el_anio: { $sum: { $cond: ['$aprobo_ambas_en_el_anio', 1, 0] } },
      suma_edad: { $sum: { $ifNull: ['$edad', 0] } },
      n_edad: { $sum: { $cond: [{ $gt: ['$edad', null] }, 1, 0] } },
      suma_edad_aprobados: { $sum: { $cond: ['$aprobado', { $ifNull: ['$edad', 0] }, 0] } },
      n_edad_aprobados: { $sum: { $cond: [{ $and: ['$aprobado', { $gt: ['$edad', null] }] }, 1, 0] } },
    },
  },
  {
    $group: {
      _id: '$_id.carrera',
      postulaciones: { $sum: '$postulaciones' },
      aspirantes: { $push: '$aspirantes' },
      aprobados: { $sum: '$aprobados' },
      aprobados_en_el_anio: { $sum: '$aprobados_en_el_anio' },
      suma_edad: { $sum: '$suma_edad' },
      n_edad: { $sum: '$n_edad' },
      suma_edad_aprobados: { $sum: '$suma_edad_aprobados' },
      n_edad_aprobados: { $sum: '$n_edad_aprobados' },
      primer_anio: { $min: '$_id.anio' },
      ultimo_anio: { $max: '$_id.anio' },
      por_anio: { $push: { anio_ingreso: '$_id.anio', postulaciones: '$postulaciones', aprobados: '$aprobados' } },
    },
  },
  {
    $project: {
      carrera: '$_id',
      postulaciones: 1,
      aspirantes_distintos: {
        $size: { $reduce: { input: '$aspirantes', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } },
      },
      aprobados: 1,
      tasa_aprobacion: { $round: [{ $multiply: [{ $divide: ['$aprobados', '$postulaciones'] }, 100] }, 2] }, // en porcentaje
      aprobados_en_el_anio: 1,
      edad_promedio: { $cond: [{ $gt: ['$n_edad', 0] }, { $round: [{ $divide: ['$suma_edad', '$n_edad'] }, 2] }, null] },
      edad_promedio_aprobados: {
        $cond: [{ $gt: ['$n_edad_aprobados', 0] }, { $round: [{ $divide: ['$suma_edad_aprobados', '$n_edad_aprobados'] }, 2] }, null],
      },
      primer_anio: 1,
      ultimo_anio: 1,
      por_anio: { $sortArray: { input: '$por_anio', sortBy: { anio_ingreso: 1 } } },
      generado_en: '$$NOW',
    },
  },
  { $merge: { into: 'resumen_carrera', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } },
];

/** Ejecuta la consulta 6 y devuelve cuántas carreras quedaron en el resumen. */
export async function crearResumenCarrera(db: Db): Promise<number> {
  await db.collection('postulaciones').aggregate(pipelineResumenCarrera).toArray();
  return db.collection('resumen_carrera').countDocuments();
}

export const consulta: ConsultaMongo = {
  id: 'q06',
  numero: 6,
  titulo: 'Colección auxiliar resumen_carrera',
  descripcion: 'Genera (o actualiza) la colección `resumen_carrera` con un resumen por carrera y muestra su contenido.',
  explicacion:
    'El pipeline agrupa `postulaciones` por carrera (con `$unwind` sobre `carreras`), calcula totales, tasas y edades promedio, y ' +
    'termina con `$merge`, que escribe el resultado en la colección `resumen_carrera` en vez de devolverlo. Al terminar, la ' +
    'consulta lee esa colección para mostrarla. Se vuelve a generar sola después de cada carga de datos.',
  coleccion: 'postulaciones',
  grafica: 'tabla',
  parametros: [],
  filtroAnio: false,
  construirPipeline: () => pipelineResumenCarrera,
  ejecutar: async (db) => {
    await crearResumenCarrera(db);
    return db.collection('resumen_carrera').find({}, { projection: { _id: 0 } }).sort({ postulaciones: -1 }).toArray();
  },
};
