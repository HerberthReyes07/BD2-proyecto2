import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q05',
  numero: 5,
  titulo: 'Edad promedio por carrera',
  descripcion: 'Edad promedio de los aspirantes agrupados por carrera objetivo.',
  explicacion:
    'Usa `postulaciones`. La edad es `anio_ingreso − anio_nacimiento` y se calculó en el ETL (R-ED1); las postulaciones sin ' +
    'edad válida (año de nacimiento `SIN REGISTRO` o fuera de 13–70) se excluyen con `$match`. `$unwind` sobre `carreras` ' +
    'cuenta cada postulación en cada una de sus carreras.',
  coleccion: 'postulaciones',
  grafica: 'barras',
  ejes: { x: 'carrera', y: ['edad_promedio'] },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { edad: { $ne: null } } },
    { $unwind: '$carreras' },
    { $group: { _id: '$carreras', edad_promedio: { $avg: '$edad' }, aspirantes: { $sum: 1 } } },
    { $sort: { edad_promedio: 1 } },
    { $project: { _id: 0, carrera: '$_id', edad_promedio: { $round: ['$edad_promedio', 2] }, aspirantes: 1 } },
  ],
};
