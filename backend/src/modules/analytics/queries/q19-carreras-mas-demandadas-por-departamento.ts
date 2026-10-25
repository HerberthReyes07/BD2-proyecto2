import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q19',
  numero: 19,
  titulo: 'Carreras más demandadas por departamento',
  descripcion: 'Las carreras con mayor demanda dentro de cada departamento de procedencia de la institución.',
  explicacion:
    'Usa `postulaciones`; la demanda es el número de postulaciones por carrera. Es un "top N por grupo": primero se cuenta por ' +
    '(departamento, carrera) y se ordena; luego un segundo `$group` junta las carreras de cada departamento en un arreglo ya ordenado ' +
    '(`$push`), `$slice` se queda con las primeras N (parámetro `top`) y `$unwind` con `includeArrayIndex` vuelve a convertirlas en ' +
    'filas numeradas (la posición en el ranking).',
  coleccion: 'postulaciones',
  grafica: 'tabla',
  parametros: [{ nombre: 'top', tipo: 'entero', requerido: false, por_defecto: 3, min: 1, max: 14, descripcion: 'Cuántas carreras mostrar por departamento' }],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { departamento: { $ne: null } } },
    { $unwind: '$carreras' },
    { $group: { _id: { departamento: '$departamento', carrera: '$carreras' }, demanda: { $sum: 1 } } },
    { $sort: { '_id.departamento': 1, demanda: -1, '_id.carrera': 1 } },
    { $group: { _id: '$_id.departamento', carreras: { $push: { carrera: '$_id.carrera', demanda: '$demanda' } } } },
    { $project: { top: { $slice: ['$carreras', Number(p.top)] } } },
    { $unwind: { path: '$top', includeArrayIndex: 'indice' } },
    { $sort: { _id: 1, indice: 1 } },
    { $project: { _id: 0, departamento: '$_id', posicion: { $add: ['$indice', 1] }, carrera: '$top.carrera', demanda: '$top.demanda' } },
  ],
};
