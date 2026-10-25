import { ConsultaMongo } from '../analytics.types';
import { pct } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q20',
  numero: 20,
  titulo: 'Evolución de la aprobación por año de ingreso',
  descripcion: 'Cantidad y porcentaje de evaluaciones aprobadas y no aprobadas en cada año de ingreso.',
  explicacion:
    'Nivel EVALUACIÓN. Se agrupa `evaluaciones` por `anio_ingreso` contando el total y las aprobadas; las no aprobadas son la ' +
    'diferencia (`$subtract`) y los porcentajes se calculan sobre el total del año. Como cada intento fallido cuenta, los ' +
    'porcentajes son bajos aunque muchos aspirantes terminen aprobando: la consulta 4 y el indicador de aspirantes dan otra mirada.',
  coleccion: 'evaluaciones',
  grafica: 'barras_apiladas',
  ejes: { x: 'anio_ingreso', y: ['aprobadas', 'no_aprobadas'], linea: 'porcentaje_aprobadas' },
  parametros: [],
  filtroAnio: false,
  construirPipeline: () => [
    { $group: { _id: '$anio_ingreso', evaluaciones: { $sum: 1 }, aprobadas: { $sum: { $cond: ['$aprobada', 1, 0] } } } },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        anio_ingreso: '$_id',
        evaluaciones: 1,
        aprobadas: 1,
        no_aprobadas: { $subtract: ['$evaluaciones', '$aprobadas'] },
        porcentaje_aprobadas: pct('$aprobadas', '$evaluaciones'),
        porcentaje_no_aprobadas: pct({ $subtract: ['$evaluaciones', '$aprobadas'] }, '$evaluaciones'),
      },
    },
  ],
};
