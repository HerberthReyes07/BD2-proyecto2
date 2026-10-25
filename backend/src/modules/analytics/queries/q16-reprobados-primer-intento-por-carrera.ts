import { ConsultaMongo } from '../analytics.types';
import { matchAnio, pct } from './comun';

export const consulta: ConsultaMongo = {
  id: 'q16',
  numero: 16,
  titulo: 'Carreras con más aspirantes reprobados en su primer intento',
  descripcion: 'Carreras objetivo con mayor cantidad de aspirantes que no aprobaron en su primera aparición del año.',
  explicacion:
    'El primer intento de un aspirante son las evaluaciones de su MENOR oportunidad en el año (no tiene que ser la 1; R-P1), ' +
    'que el ETL guardó en `primer_intento`. Con `criterio=alguna` (por defecto) cuenta como reprobado quien falló AL MENOS UNA ' +
    'materia en ese primer intento; con `criterio=todas` solo quien falló todas (`$anyElementTrue` sobre los resultados). ' +
    'Se despliegan las carreras del primer intento y se compara contra el total de aspirantes de esa carrera.',
  coleccion: 'postulaciones',
  grafica: 'barras',
  ejes: { x: 'carrera', y: ['reprobados'] },
  parametros: [
    {
      nombre: 'criterio',
      tipo: 'opcion',
      requerido: false,
      por_defecto: 'alguna',
      opciones: ['alguna', 'todas'],
      descripcion: 'alguna = reprobó al menos una materia; todas = reprobó todas las que presentó',
    },
  ],
  filtroAnio: true,
  construirPipeline: (p) => [
    ...matchAnio(p),
    { $unwind: '$primer_intento.carreras' },
    {
      $group: {
        _id: '$primer_intento.carreras',
        aspirantes: { $sum: 1 },
        reprobados: {
          $sum: {
            $cond: [
              p.criterio === 'todas'
                ? { $not: [{ $anyElementTrue: ['$primer_intento.resultados.aprobada'] }] }
                : '$primer_intento.reprobo',
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { reprobados: -1, _id: 1 } },
    { $project: { _id: 0, carrera: '$_id', aspirantes: 1, reprobados: 1, porcentaje_reprobados: pct('$reprobados', '$aspirantes') } },
  ],
};
