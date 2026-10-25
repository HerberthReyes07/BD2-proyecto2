import { ConsultaMongo } from '../analytics.types';
import { idAspiranteDesdeParametro } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q15',
  numero: 15,
  titulo: 'Historial completo de un aspirante',
  descripcion: 'Toda la información disponible de un aspirante identificado por su correlativo.',
  explicacion:
    'Se busca el documento de `aspirantes` por `_id` y `$lookup` trae todas sus `postulaciones` (la colección derivada, con el ' +
    'estado de aprobación de cada año). `$sortArray` ordena las postulaciones por año. El resultado reúne en un solo documento ' +
    'los datos de la persona, su habilitación, cada postulación y el historial completo de evaluaciones.',
  coleccion: 'aspirantes',
  grafica: 'detalle',
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
    { $lookup: { from: 'postulaciones', localField: '_id', foreignField: 'aspirante_id', as: 'postulaciones' } },
    {
      $project: {
        correlativo_original: 1,
        sexo: 1,
        anio_nacimiento: 1,
        tipo_institucion: 1,
        departamento: 1,
        municipio: 1,
        anios_ingreso: 1,
        habilitacion: 1,
        advertencias: 1,
        postulaciones: { $sortArray: { input: '$postulaciones', sortBy: { anio_ingreso: 1 } } },
        historial: 1,
      },
    },
  ],
};
