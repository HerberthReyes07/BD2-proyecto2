import { ConsultaMongo } from '../analytics.types';
import { matchAnio, pct } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q18',
  numero: 18,
  titulo: 'Tasa de aprobación por tipo de institución educativa',
  descripcion: 'Porcentaje de aspirantes aprobados en cada tipo de institución, para compararlos.',
  explicacion:
    'Usa `postulaciones`. Se agrupa por `tipo_institucion` y se cuentan las postulaciones totales y las aprobadas (indicador ' +
    'principal). La tasa es aprobados / total * 100. Se excluyen las postulaciones sin tipo de institución.',
  coleccion: 'postulaciones',
  grafica: 'barras',
  ejes: { x: 'tipo_institucion', y: ['tasa_aprobacion'] },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { tipo_institucion: { $ne: null } } },
    { $group: { _id: '$tipo_institucion', aspirantes: { $sum: 1 }, aprobados: { $sum: { $cond: ['$aprobado', 1, 0] } } } },
    { $sort: { aspirantes: -1 } },
    { $project: { _id: 0, tipo_institucion: '$_id', aspirantes: 1, aprobados: 1, tasa_aprobacion: pct('$aprobados', '$aspirantes') } },
  ],
};
