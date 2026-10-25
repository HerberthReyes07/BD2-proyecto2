import { ConsultaMongo } from '../analytics.types';

export const consulta: ConsultaMongo = {
  id: 'q12',
  numero: 12,
  titulo: 'Distribución por sexo y tipo de institución educativa',
  descripcion: 'Cantidad de aspirantes (personas distintas) agrupados por sexo y por tipo de institución.',
  explicacion:
    'Usa `aspirantes` (una fila por persona). Se agrupa por el par (sexo, tipo de institución). Los aspirantes sin sexo registrado ' +
    '(`null` desde el ETL) se muestran como `SIN REGISTRO` con `$ifNull`; los que no tienen tipo de institución se excluyen.',
  coleccion: 'aspirantes',
  grafica: 'barras_apiladas',
  ejes: { x: 'tipo_institucion', y: ['aspirantes'], serie: 'sexo' },
  parametros: [],
  filtroAnio: false,
  construirPipeline: () => [
    { $match: { tipo_institucion: { $ne: null } } },
    { $group: { _id: { sexo: { $ifNull: ['$sexo', 'SIN REGISTRO'] }, tipo_institucion: '$tipo_institucion' }, aspirantes: { $sum: 1 } } },
    { $sort: { '_id.tipo_institucion': 1, '_id.sexo': 1 } },
    { $project: { _id: 0, tipo_institucion: '$_id.tipo_institucion', sexo: '$_id.sexo', aspirantes: 1 } },
  ],
};
