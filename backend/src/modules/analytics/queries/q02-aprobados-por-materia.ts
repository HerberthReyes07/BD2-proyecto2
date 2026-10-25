import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q02',
  numero: 2,
  titulo: 'Cantidad de evaluaciones aprobadas por materia',
  descripcion: 'Número de evaluaciones aprobadas, agrupadas por materia.',
  explicacion:
    'Es una consulta a nivel de EVALUACIÓN (una fila del CSV): se filtran las evaluaciones con `aprobada = true` ' +
    'y se cuentan por materia. Un aspirante que aprueba una materia en su tercer intento aporta una sola evaluación aprobada.',
  coleccion: 'evaluaciones',
  grafica: 'barras',
  ejes: { x: 'materia', y: ['aprobadas'] },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { aprobada: true } },
    { $group: { _id: '$materia', aprobadas: { $sum: 1 } } },
    { $sort: { aprobadas: -1 } },
    { $project: { _id: 0, materia: '$_id', aprobadas: 1 } },
  ],
};
