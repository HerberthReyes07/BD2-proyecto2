import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q14',
  numero: 14,
  titulo: 'Número promedio de intentos por materia',
  descripcion: 'Promedio de oportunidades de evaluación que usan los aspirantes en cada materia dentro de un año de ingreso.',
  explicacion:
    'Usa `postulaciones`, cuyo arreglo embebido `materias` ya trae `intentos` (cuántas evaluaciones tuvo esa materia en el año). ' +
    '`$unwind` da una fila por (postulación, materia) y se promedia por materia. Un "intento" es una aparición del aspirante, ' +
    'no el número de oportunidad: quien aparece por primera vez en la oportunidad 3 está en su intento 1.',
  coleccion: 'postulaciones',
  grafica: 'barras',
  ejes: { x: 'materia', y: ['promedio_intentos'] },
  parametros: [],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $unwind: '$materias' },
    {
      $group: {
        _id: '$materias.materia',
        promedio_intentos: { $avg: '$materias.intentos' },
        maximo_intentos: { $max: '$materias.intentos' },
        aspirantes: { $sum: 1 },
      },
    },
    { $sort: { aspirantes: -1 } },
    { $project: { _id: 0, materia: '$_id', promedio_intentos: { $round: ['$promedio_intentos', 2] }, maximo_intentos: 1, aspirantes: 1 } },
  ],
};
