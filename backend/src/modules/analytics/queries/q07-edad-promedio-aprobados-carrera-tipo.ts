import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q07',
  numero: 7,
  titulo: 'Edad promedio de aprobados por carrera y tipo de institución',
  descripcion: 'Edad promedio de los aspirantes aprobados, agrupada por carrera objetivo y tipo de institución educativa.',
  explicacion:
    'Usa `postulaciones` con `aprobado = true` (indicador principal) y edad válida. Después de `$unwind` sobre `carreras` se ' +
    'agrupa por el par (carrera, tipo de institución). Se excluyen las postulaciones sin tipo de institución.',
  coleccion: 'postulaciones',
  grafica: 'barras_agrupadas',
  ejes: { x: 'carrera', y: ['edad_promedio'], serie: 'tipo_institucion' },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { aprobado: true, edad: { $ne: null }, tipo_institucion: { $ne: null } } },
    { $unwind: '$carreras' },
    { $group: { _id: { carrera: '$carreras', tipo_institucion: '$tipo_institucion' }, edad_promedio: { $avg: '$edad' }, aprobados: { $sum: 1 } } },
    { $sort: { '_id.carrera': 1, '_id.tipo_institucion': 1 } },
    {
      $project: {
        _id: 0,
        carrera: '$_id.carrera',
        tipo_institucion: '$_id.tipo_institucion',
        edad_promedio: { $round: ['$edad_promedio', 2] },
        aprobados: 1,
      },
    },
  ],
};
