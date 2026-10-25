import { PARAM_ANIO } from '../../analytics/queries/comun';
import { ConsultaCypher } from '../graph.types';

export const consulta: ConsultaCypher = {
  id: 'g01',
  numero: 1,
  titulo: 'Carreras más demandadas desde un departamento',
  descripcion: 'Qué carreras eligen los aspirantes que proceden de un departamento, opcionalmente en un año de ingreso.',
  explicacion:
    'Recorre tres saltos del grafo: Carrera ← Postulacion → Municipio → Departamento. Se parte del nodo `Departamento` elegido, ' +
    'se sube por `PERTENECE_A` hasta sus `Municipio`, se baja por `PROCEDE_DE` hasta las `Postulacion` y se sigue `ASPIRA_A` hasta la ' +
    '`Carrera`. El filtro por año usa la propiedad `anio_ingreso` de la postulación; `$anio_ingreso IS NULL` hace que el filtro sea opcional.',
  demuestra: ['Recorrido de 3 relaciones', 'Filtro por propiedad de nodo', 'Agregación con count'],
  cypher: `MATCH (d:Departamento {nombre: $departamento})<-[:PERTENECE_A]-(:Municipio)<-[:PROCEDE_DE]-(p:Postulacion)-[:ASPIRA_A]->(c:Carrera)
WHERE $anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso
RETURN c.nombre AS carrera,
       count(p) AS postulaciones,
       sum(CASE WHEN p.aprobado THEN 1 ELSE 0 END) AS aprobados
ORDER BY postulaciones DESC
LIMIT $limite`,
  parametros: [
    { nombre: 'departamento', tipo: 'texto', requerido: false, por_defecto: 'QUETZALTENANGO', patron: '^[a-zñáéíóú ]{3,30}$', descripcion: 'Departamento de la institución (en mayúsculas, por ejemplo GUATEMALA)' },
    PARAM_ANIO,
    { nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 10, min: 1, max: 30, descripcion: 'Cuántas carreras mostrar' },
  ],
  grafica: 'barras',
  ejes: { x: 'carrera', y: ['postulaciones'] },
  preparar: (p) => ({ ...p, departamento: String(p.departamento).toUpperCase() }),
};
