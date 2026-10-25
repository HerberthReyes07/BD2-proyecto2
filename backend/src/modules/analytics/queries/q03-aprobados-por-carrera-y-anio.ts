import { ConsultaMongo } from '../analytics.types';

export const consulta: ConsultaMongo = {
  id: 'q03',
  numero: 3,
  titulo: 'Aspirantes aprobados por carrera y año de ingreso',
  descripcion: 'Cantidad de aspirantes aprobados (habilitados) agrupados por carrera objetivo y año de ingreso.',
  explicacion:
    'Usa `postulaciones` (un aspirante en un año). Se filtran las postulaciones con `aprobado = true` (indicador principal: ' +
    'Matemática y Computación aprobadas con vigencia de 2 años por materia). `$unwind` convierte el arreglo `carreras` en una fila por ' +
    'carrera, de modo que una postulación con dos carreras cuenta en ambas. Las postulaciones sin carrera (casi todas de 2015, donde ' +
    'la carrera era `NINGUNO`) no aparecen aquí.',
  coleccion: 'postulaciones',
  grafica: 'barras_agrupadas',
  ejes: { x: 'anio_ingreso', y: ['aprobados'], serie: 'carrera' },
  parametros: [],
  filtroAnio: false,
  construirPipeline: () => [
    { $match: { aprobado: true } },
    { $unwind: '$carreras' },
    { $group: { _id: { carrera: '$carreras', anio_ingreso: '$anio_ingreso' }, aprobados: { $sum: 1 } } },
    { $sort: { '_id.anio_ingreso': 1, '_id.carrera': 1 } },
    { $project: { _id: 0, anio_ingreso: '$_id.anio_ingreso', carrera: '$_id.carrera', aprobados: 1 } },
  ],
};
