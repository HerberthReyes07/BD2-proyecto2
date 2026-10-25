import { PARAM_ANIO } from '../../analytics/queries/comun';
import { ConsultaCypher } from '../graph.types';

export const consulta: ConsultaCypher = {
  id: 'g03',
  numero: 3,
  titulo: 'Aspirantes que cambian de carrera de un año al siguiente',
  descripcion: 'De qué carrera a qué carrera se mueven los aspirantes que vuelven a postular al año siguiente.',
  explicacion:
    'El recorrido cruza dos años a través del nodo `Aspirante`: Carrera ← Postulacion (año N) ← Aspirante → Postulacion (año N+1) → Carrera. ' +
    'La condición `p2.anio_ingreso = p1.anio_ingreso + 1` limita a años consecutivos. Las dos negaciones `NOT (p)-[:ASPIRA_A]->(c)` ' +
    'descartan a quien conserva una de sus carreras, de modo que solo cuentan cambios reales. El parámetro `anio_ingreso`, si se indica, ' +
    'es el año al que llegan (N+1).',
  demuestra: ['Recorrido que cruza años a través del aspirante', 'Aritmética sobre propiedades', 'Negación de patrones'],
  cypher: `MATCH (a:Aspirante)-[:POSTULO]->(p1:Postulacion)-[:ASPIRA_A]->(c1:Carrera),
      (a)-[:POSTULO]->(p2:Postulacion)-[:ASPIRA_A]->(c2:Carrera)
WHERE p2.anio_ingreso = p1.anio_ingreso + 1
  AND NOT (p2)-[:ASPIRA_A]->(c1)
  AND NOT (p1)-[:ASPIRA_A]->(c2)
  AND ($anio_ingreso IS NULL OR p2.anio_ingreso = $anio_ingreso)
RETURN c1.nombre AS desde, c2.nombre AS hacia, count(DISTINCT a) AS aspirantes
ORDER BY aspirantes DESC
LIMIT $limite`,
  parametros: [
    { ...PARAM_ANIO, descripcion: 'Año al que llegan los aspirantes (el año siguiente al de origen)' },
    { nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 15, min: 1, max: 50, descripcion: 'Cuántos cambios mostrar' },
  ],
  grafica: 'tabla',
};
