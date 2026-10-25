import { ConsultaCypher } from '../graph.types';

export const consulta: ConsultaCypher = {
  id: 'g06',
  numero: 6,
  titulo: 'Aspirantes que postulan varios años y cuántos terminan aprobando',
  descripcion: 'Para quienes participaron en N años o más, cuántos llegaron a aprobar en alguno de ellos.',
  explicacion:
    'Cuenta las relaciones `POSTULO` de cada `Aspirante` (cuántos años participó) y, con `max(CASE ...)`, si alguna de sus ' +
    'postulaciones quedó con `aprobado = true`. El primer `WITH` agrupa por aspirante; el `RETURN` vuelve a agrupar por número de años. ' +
    'Permite comparar el porcentaje de quienes terminan aprobando según cuántos años participaron.',
  demuestra: ['Conteo de relaciones por nodo', 'Agregación en dos niveles con WITH', 'Comparación entre grupos'],
  cypher: `MATCH (a:Aspirante)-[:POSTULO]->(p:Postulacion)
WITH a, count(p) AS anios, max(CASE WHEN p.aprobado THEN 1 ELSE 0 END) AS aprobo
WHERE anios >= $minimo_anios
RETURN anios AS anios_de_participacion,
       count(a) AS aspirantes,
       sum(aprobo) AS aprobaron,
       round(100.0 * sum(aprobo) / count(a), 2) AS porcentaje_aprobaron
ORDER BY anios_de_participacion`,
  parametros: [{ nombre: 'minimo_anios', tipo: 'entero', requerido: false, por_defecto: 1, min: 1, max: 10, descripcion: 'Mínimo de años de participación' }],
  grafica: 'barras',
  ejes: { x: 'anios_de_participacion', y: ['porcentaje_aprobaron'] },
};
