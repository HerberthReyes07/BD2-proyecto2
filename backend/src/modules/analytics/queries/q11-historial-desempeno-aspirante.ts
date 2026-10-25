import { ConsultaMongo } from '../analytics.types';
import { idAspiranteDesdeParametro } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q11',
  numero: 11,
  titulo: 'Historial de desempeño por aspirante',
  descripcion: 'Evaluaciones, materias, intentos y resultados de un aspirante, año por año.',
  explicacion:
    'Se lee un solo documento de `aspirantes` (por su `_id`) y se despliega su arreglo embebido `historial`. Después de ordenar por ' +
    'año, oportunidad y fecha, `$group` arma una fila por (año de ingreso, materia) con el número de intentos, si aprobó ' +
    '(`$max` sobre booleanos: `true` es mayor que `false`) y el detalle de cada intento, que `$push` conserva en orden.',
  coleccion: 'aspirantes',
  grafica: 'tabla',
  parametros: [
    {
      nombre: 'aspirante_id',
      tipo: 'texto',
      requerido: true,
      patron: '^[0-9a-f]{20,32}$',
      descripcion: 'Identificador del aspirante (el correlativo de 20 o 32 caracteres)',
    },
  ],
  filtroAnio: false,
  vacioEs404: 'No existe un aspirante con ese identificador.',
  construirPipeline: (p) => [
    { $match: { _id: idAspiranteDesdeParametro(p) } },
    { $unwind: '$historial' },
    { $sort: { 'historial.anio_ingreso': 1, 'historial.oportunidad': 1, 'historial.fecha': 1 } },
    {
      $group: {
        _id: { anio_ingreso: '$historial.anio_ingreso', materia: '$historial.materia' },
        intentos: { $sum: 1 },
        aprobada: { $max: '$historial.aprobada' },
        detalle: {
          $push: {
            oportunidad: '$historial.oportunidad',
            fecha: '$historial.fecha',
            aprobada: '$historial.aprobada',
            carrera: '$historial.carrera',
          },
        },
      },
    },
    { $sort: { '_id.anio_ingreso': 1, '_id.materia': 1 } },
    { $project: { _id: 0, anio_ingreso: '$_id.anio_ingreso', materia: '$_id.materia', intentos: 1, aprobada: 1, detalle: 1 } },
  ],
};
