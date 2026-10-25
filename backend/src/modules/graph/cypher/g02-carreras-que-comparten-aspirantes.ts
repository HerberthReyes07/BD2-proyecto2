import { PARAM_ANIO } from '../../analytics/queries/comun';
import { ConsultaCypher } from '../graph.types';

export const consulta: ConsultaCypher = {
  id: 'g02',
  numero: 2,
  titulo: 'Pares de carreras que comparten aspirantes',
  descripcion: 'Qué carreras aparecen juntas en una misma postulación: aspirantes que dudan entre dos opciones.',
  explicacion:
    'Un patrón con dos relaciones `ASPIRA_A` que salen de la misma `Postulacion` hacia dos `Carrera` distintas. La condición ' +
    '`c1.nombre < c2.nombre` evita contar cada par dos veces (A–B y B–A). Es una consulta muy natural en grafos: dos nodos que ' +
    'se conectan a través de un tercero. En MongoDB habría que comparar arreglos de carreras.',
  demuestra: ['Patrón con un nodo intermedio compartido', 'Dos relaciones del mismo tipo', 'Filtro opcional por propiedad'],
  cypher: `MATCH (c1:Carrera)<-[:ASPIRA_A]-(p:Postulacion)-[:ASPIRA_A]->(c2:Carrera)
WHERE c1.nombre < c2.nombre
  AND ($anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso)
RETURN c1.nombre AS carrera_a, c2.nombre AS carrera_b, count(p) AS postulaciones
ORDER BY postulaciones DESC
LIMIT $limite`,
  parametros: [PARAM_ANIO, { nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 10, min: 1, max: 50, descripcion: 'Cuántos pares mostrar' }],
  grafica: 'tabla',
};
