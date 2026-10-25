import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q09',
  numero: 9,
  titulo: 'Evaluaciones por mes y materia (instituciones públicas)',
  descripcion: 'Cantidad de evaluaciones realizadas cada mes, por materia, solo de aspirantes de instituciones públicas.',
  explicacion:
    'Usa `evaluaciones`. Se filtra `tipo_institucion = PUBLICO` y se agrupa por (año-mes, materia). El campo `anio_mes` ' +
    '(por ejemplo `2014-08`) se calculó en el ETL a partir de `fecha_asignacion`; agrupar por año-mes y no solo por mes ' +
    'del año da una serie de tiempo más informativa. Es un conteo de evaluaciones, no de personas.',
  coleccion: 'evaluaciones',
  grafica: 'lineas',
  ejes: { x: 'anio_mes', y: ['evaluaciones'], serie: 'materia' },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { tipo_institucion: 'PUBLICO' } },
    { $group: { _id: { anio_mes: '$anio_mes', materia: '$materia' }, evaluaciones: { $sum: 1 } } },
    { $sort: { '_id.anio_mes': 1, '_id.materia': 1 } },
    { $project: { _id: 0, anio_mes: '$_id.anio_mes', materia: '$_id.materia', evaluaciones: 1 } },
  ],
};
