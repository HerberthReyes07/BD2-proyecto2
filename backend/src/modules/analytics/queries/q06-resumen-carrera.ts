import { Db, Document } from 'mongodb';

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
      tasa_aprobacion: { $multiply: [{ $divide: ['$aprobados', '$postulaciones'] }, 100] }, // en porcentaje
      aprobados_en_el_anio: 1,
      edad_promedio: { $cond: [{ $gt: ['$n_edad', 0] }, { $divide: ['$suma_edad', '$n_edad'] }, null] },
      edad_promedio_aprobados: {
        $cond: [{ $gt: ['$n_edad_aprobados', 0] }, { $divide: ['$suma_edad_aprobados', '$n_edad_aprobados'] }, null],
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
