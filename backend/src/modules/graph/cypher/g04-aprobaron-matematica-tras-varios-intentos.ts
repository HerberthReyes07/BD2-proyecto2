import { PARAM_ANIO } from '../../analytics/queries/comun';
import { ConsultaCypher } from '../graph.types';

export const consulta: ConsultaCypher = {
  id: 'g04',
  numero: 4,
  titulo: 'Aprobaron Matemática tras varios intentos, por tipo de institución',
  descripcion: 'Entre quienes aprobaron Matemática, cuántos lo lograron hasta su intento N o posterior, según el tipo de institución.',
  explicacion:
    'Filtra por una propiedad de la RELACIÓN: `EVALUADA_EN` guarda `aprobada` e `intento` (la posición de la evaluación entre las de esa ' +
    'materia en el año). Se parte de la `Materia` Matemática, se toman las evaluaciones aprobadas y se une cada postulación con su ' +
    '`TipoInstitucion`. `count(DISTINCT CASE ... END)` cuenta solo las postulaciones cuyo intento aprobado fue ≥ `intento_minimo`. ' +
    'Un aspirante con dos aprobaciones se cuenta una sola vez gracias a `DISTINCT`.',
  demuestra: ['Propiedades en relaciones', 'Filtro sobre propiedades de la relación', 'Unión con un segundo recorrido'],
  cypher: `MATCH (p:Postulacion)-[r:EVALUADA_EN]->(:Materia {nombre: 'MATEMATICA'})
WHERE r.aprobada
  AND ($anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso)
MATCH (p)-[:EN_INSTITUCION]->(t:TipoInstitucion)
WITH t.nombre AS tipo_institucion,
     count(DISTINCT p) AS aprobaron,
     count(DISTINCT CASE WHEN r.intento >= $intento_minimo THEN p END) AS tras_varios_intentos
RETURN tipo_institucion, aprobaron, tras_varios_intentos,
       round(100.0 * tras_varios_intentos / aprobaron, 2) AS porcentaje
ORDER BY aprobaron DESC`,
  parametros: [
    PARAM_ANIO,
    { nombre: 'intento_minimo', tipo: 'entero', requerido: false, por_defecto: 3, min: 1, max: 10, descripcion: 'Intento a partir del cual se considera "tras varios intentos"' },
  ],
  grafica: 'barras_agrupadas',
  ejes: { x: 'tipo_institucion', y: ['aprobaron', 'tras_varios_intentos'] },
};
