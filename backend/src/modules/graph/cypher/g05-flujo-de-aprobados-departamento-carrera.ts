import { PARAM_ANIO } from '../../analytics/queries/comun';
import { ConsultaCypher } from '../graph.types';

export const consulta: ConsultaCypher = {
  id: 'g05',
  numero: 5,
  titulo: 'Flujo de aprobados: de qué departamentos a qué carreras',
  descripcion: 'Combinaciones departamento → carrera con más aspirantes aprobados (habilitados).',
  explicacion:
    'Un camino largo del grafo: Departamento ← Municipio ← Postulacion → Carrera, pero restringido a las postulaciones con la ' +
    'propiedad `aprobado: true`, que se escribe directamente dentro del patrón del nodo. Cada fila es una "arista" departamento–carrera ' +
    'ponderada por el número de aprobados: es la misma información que dibuja el mapa de demanda del explorador de grafos.',
  demuestra: ['Camino de varias relaciones', 'Propiedad de nodo dentro del patrón', 'Resultado como aristas ponderadas'],
  cypher: `MATCH (d:Departamento)<-[:PERTENECE_A]-(:Municipio)<-[:PROCEDE_DE]-(p:Postulacion {aprobado: true})-[:ASPIRA_A]->(c:Carrera)
WHERE $anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso
RETURN d.nombre AS departamento, c.nombre AS carrera, count(p) AS aprobados
ORDER BY aprobados DESC, departamento, carrera
LIMIT $limite`,
  parametros: [PARAM_ANIO, { nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 20, min: 1, max: 100, descripcion: 'Cuántos flujos mostrar' }],
  grafica: 'tabla',
};
