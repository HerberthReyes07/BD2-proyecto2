import { ConsultaMongo } from '../analytics.types';
import { matchAnio, pct } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q04',
  numero: 4,
  titulo: 'Porcentaje de aprobación por materia',
  descripcion: 'Porcentaje de aprobación de cada materia, medido de dos maneras: por evaluación y por aspirante.',
  explicacion:
    'Principal: aprobadas / evaluaciones (nivel evaluación, el mismo criterio de la consulta 2). Como quien reprueba vuelve a ' +
    'intentarlo, los reintentos fallidos bajan este porcentaje. Informativo: a nivel aspirante-materia-año (¿aprobó la materia en ' +
    'algún intento de ese año?), que se calcula con un `$lookup` a `postulaciones`. Es una medida mucho más alta y más cercana a la ' +
    'experiencia de una persona.',
  coleccion: 'evaluaciones',
  grafica: 'barras_agrupadas',
  ejes: { x: 'materia', y: ['porcentaje_evaluaciones', 'porcentaje_aspirantes'] },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $group: { _id: '$materia', evaluaciones: { $sum: 1 }, aprobadas: { $sum: { $cond: ['$aprobada', 1, 0] } } } },
    {
      $lookup: {
        from: 'postulaciones',
        let: { m: '$_id' },
        pipeline: [
          ...matchAnio(p),
          { $unwind: '$materias' },
          { $match: { $expr: { $eq: ['$materias.materia', '$$m'] } } },
          { $group: { _id: null, aspirantes: { $sum: 1 }, aprobados: { $sum: { $cond: ['$materias.aprobada', 1, 0] } } } },
        ],
        as: 'por_aspirante',
      },
    },
    { $unwind: { path: '$por_aspirante', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        materia: '$_id',
        evaluaciones: 1,
        aprobadas: 1,
        porcentaje_evaluaciones: pct('$aprobadas', '$evaluaciones'),
        aspirantes_materia: { $ifNull: ['$por_aspirante.aspirantes', 0] },
        aprobados_aspirante: { $ifNull: ['$por_aspirante.aprobados', 0] },
        porcentaje_aspirantes: {
          $cond: [{ $gt: [{ $ifNull: ['$por_aspirante.aspirantes', 0] }, 0] }, pct('$por_aspirante.aprobados', '$por_aspirante.aspirantes'), null],
        },
      },
    },
    { $sort: { evaluaciones: -1 } },
  ],
};
