import { ConsultaMongo } from '../analytics.types';
import { matchAnio } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q08',
  numero: 8,
  titulo: 'Distribución de aprobados por municipio y carrera',
  descripcion: 'Cantidad de aspirantes aprobados según el municipio de su institución y la carrera objetivo.',
  explicacion:
    'Usa `postulaciones` con `aprobado = true`. Se agrupa por (departamento, municipio, carrera): el departamento forma parte ' +
    'de la clave porque hay municipios con el mismo nombre en departamentos distintos (R-G6). Se ordena de mayor a menor y se ' +
    'limita el número de filas (parámetro `limite`) porque hay cientos de combinaciones.',
  coleccion: 'postulaciones',
  grafica: 'tabla',
  parametros: [{ nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 200, min: 1, max: 2000, descripcion: 'Máximo de filas a devolver' }],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $match: { aprobado: true, departamento: { $ne: null }, municipio: { $ne: null } } },
    { $unwind: '$carreras' },
    { $group: { _id: { departamento: '$departamento', municipio: '$municipio', carrera: '$carreras' }, aprobados: { $sum: 1 } } },
    { $sort: { aprobados: -1, '_id.departamento': 1, '_id.municipio': 1, '_id.carrera': 1 } },
    { $limit: Number(p.limite) },
    {
      $project: {
        _id: 0,
        departamento: '$_id.departamento',
        municipio: '$_id.municipio',
        carrera: '$_id.carrera',
        aprobados: 1,
      },
    },
  ],
};
