import { ConsultaMongo } from '../analytics.types';

export const consulta: ConsultaMongo = {
  id: 'q01',
  numero: 1,
  titulo: 'Aspirantes por tipo de institución educativa',
  descripcion: 'Cantidad de aspirantes (personas distintas) agrupados por el tipo de institución de la que proceden.',
  explicacion:
    'La colección `aspirantes` tiene un documento por persona, así que contar documentos es contar personas. ' +
    'Se excluyen los aspirantes sin dato de institución (`SIN DATOS` pasó a `null` en el ETL).',
  coleccion: 'aspirantes',
  grafica: 'pastel',
  ejes: { x: 'tipo_institucion', y: ['aspirantes'] },
  parametros: [],
  filtroAnio: false,
  construirPipeline: () => [
    { $match: { tipo_institucion: { $ne: null } } },
    { $group: { _id: '$tipo_institucion', aspirantes: { $sum: 1 } } },
    { $sort: { aspirantes: -1 } },
    { $project: { _id: 0, tipo_institucion: '$_id', aspirantes: 1 } },
  ],
};
