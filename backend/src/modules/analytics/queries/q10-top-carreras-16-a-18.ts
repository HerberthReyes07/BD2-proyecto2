import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q10',
  numero: 10,
  titulo: 'Top 5 de carreras más demandadas entre 16 y 18 años',
  descripcion: 'Las carreras con más aspirantes dentro de un rango de edad (por defecto de 16 a 18 años).',
  explicacion:
    'Usa `postulaciones`. Se filtra la edad con `$gte` y `$lte` (parámetros `edad_min` y `edad_max`, por defecto 16 y 18), se ' +
    'despliega `carreras`, se cuenta por carrera, se ordena de mayor a menor y `$limit` deja las primeras (`limite`, por defecto 5). ' +
    'La demanda es el número de postulaciones (aspirante + año de ingreso). No incluye postulaciones sin carrera.',
  coleccion: 'postulaciones',
  grafica: 'barras',
  ejes: { x: 'carrera', y: ['aspirantes'] },
  parametros: [
    { nombre: 'edad_min', tipo: 'entero', requerido: false, por_defecto: 16, min: 13, max: 70, descripcion: 'Edad mínima' },
    { nombre: 'edad_max', tipo: 'entero', requerido: false, por_defecto: 18, min: 13, max: 70, descripcion: 'Edad máxima' },
    { nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 5, min: 1, max: 20, descripcion: 'Cuántas carreras mostrar' },
  ],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { edad: { $gte: Number(p.edad_min), $lte: Number(p.edad_max) } } },
    { $unwind: '$carreras' },
    { $group: { _id: '$carreras', aspirantes: { $sum: 1 } } },
    { $sort: { aspirantes: -1, _id: 1 } },
    { $limit: Number(p.limite) },
    { $project: { _id: 0, carrera: '$_id', aspirantes: 1 } },
  ],
};
