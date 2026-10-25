import { ConsultaMongo } from '../analytics.types';

export const consulta: ConsultaMongo = {
  id: 'q17',
  numero: 17,
  titulo: 'Top 5 de municipios con más aspirantes',
  descripcion: 'Los cinco municipios de procedencia de las instituciones con mayor cantidad de aspirantes.',
  explicacion:
    'Usa `aspirantes` (cada persona cuenta una vez). La clave de agrupación es (departamento, municipio), porque hay municipios con ' +
    'el mismo nombre en departamentos distintos (R-G6). La capital aparece como un solo municipio, `GUATEMALA`, sumando todas sus zonas ' +
    '(R-G4). `$concat` arma una etiqueta legible para la gráfica.',
  coleccion: 'aspirantes',
  grafica: 'barras',
  ejes: { x: 'lugar', y: ['aspirantes'] },
  parametros: [{ nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 5, min: 1, max: 50, descripcion: 'Cuántos municipios mostrar' }],
  filtroAnio: false,
  construirPipeline: (p) => [
    { $match: { departamento: { $ne: null }, municipio: { $ne: null } } },
    { $group: { _id: { departamento: '$departamento', municipio: '$municipio' }, aspirantes: { $sum: 1 } } },
    { $sort: { aspirantes: -1, '_id.departamento': 1, '_id.municipio': 1 } },
    { $limit: Number(p.limite) },
    {
      $project: {
        _id: 0,
        departamento: '$_id.departamento',
        municipio: '$_id.municipio',
        lugar: { $concat: ['$_id.municipio', ' (', '$_id.departamento', ')'] },
        aspirantes: 1,
      },
    },
  ],
};
