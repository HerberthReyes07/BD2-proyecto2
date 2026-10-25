import { ConsultaMongo } from '../analytics.types';
import { matchAnio, pct } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q13',
  numero: 13,
  titulo: 'Tasa de aprobación por edad',
  descripcion: 'Porcentaje de aspirantes aprobados para cada edad.',
  explicacion:
    'Usa `postulaciones` con edad válida. Se agrupa por `edad` y se cuentan las postulaciones totales y las aprobadas ' +
    '(`aprobado = true`, indicador principal). La tasa es aprobados / total * 100. Las edades con muy pocos aspirantes ' +
    '(por encima de unos 40 años) dan porcentajes poco confiables: conviene mirar también la columna `aspirantes`.',
  coleccion: 'postulaciones',
  grafica: 'lineas',
  ejes: { x: 'edad', y: ['tasa_aprobacion'] },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { edad: { $ne: null } } },
    { $group: { _id: '$edad', aspirantes: { $sum: 1 }, aprobados: { $sum: { $cond: ['$aprobado', 1, 0] } } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, edad: '$_id', aspirantes: 1, aprobados: 1, tasa_aprobacion: pct('$aprobados', '$aspirantes') } },
  ],
};
