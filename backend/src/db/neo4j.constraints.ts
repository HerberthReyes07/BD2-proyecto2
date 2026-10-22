import { conSesion } from '../config/neo4j';

/**
 * Restricciones de unicidad e índices de Neo4j (ver docs/modelo-neo4j.md §6).
 * Con IF NOT EXISTS son idempotentes. Cada restricción de unicidad crea además su propio índice.
 */
const SENTENCIAS = [
  'CREATE CONSTRAINT aspirante_id IF NOT EXISTS FOR (a:Aspirante) REQUIRE a.id IS UNIQUE',
  'CREATE CONSTRAINT postulacion_id IF NOT EXISTS FOR (p:Postulacion) REQUIRE p.id IS UNIQUE',
  'CREATE CONSTRAINT carrera_nombre IF NOT EXISTS FOR (c:Carrera) REQUIRE c.nombre IS UNIQUE',
  'CREATE CONSTRAINT materia_nombre IF NOT EXISTS FOR (m:Materia) REQUIRE m.nombre IS UNIQUE',
  'CREATE CONSTRAINT tipo_nombre IF NOT EXISTS FOR (t:TipoInstitucion) REQUIRE t.nombre IS UNIQUE',
  'CREATE CONSTRAINT departamento_nombre IF NOT EXISTS FOR (d:Departamento) REQUIRE d.nombre IS UNIQUE',
  'CREATE CONSTRAINT municipio_id IF NOT EXISTS FOR (m:Municipio) REQUIRE m.id IS UNIQUE',
  'CREATE INDEX postulacion_anio IF NOT EXISTS FOR (p:Postulacion) ON (p.anio_ingreso)',
  'CREATE INDEX postulacion_aprobado IF NOT EXISTS FOR (p:Postulacion) ON (p.aprobado)',
];

export async function crearRestriccionesNeo4j(): Promise<void> {
  await conSesion(async (sesion) => {
    for (const sentencia of SENTENCIAS) {
      await sesion.run(sentencia);
    }
  });
}
