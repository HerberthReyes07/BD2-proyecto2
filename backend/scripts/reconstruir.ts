/**
 * Reconstruye las colecciones derivadas de MongoDB y sincroniza Neo4j SIN volver a leer los CSV.
 * Útil si una sincronización con Neo4j falló: las evaluaciones ya están en MongoDB.
 *
 * Uso: npm run reconstruir
 */
import { cerrarMongo, getDb } from '../src/config/mongo';
import { cerrarNeo4j } from '../src/config/neo4j';
import { crearIndicesMongo } from '../src/db/mongo.indexes';
import { reconstruirTodo } from '../src/modules/etl/etl.service';

async function main() {
  await crearIndicesMongo(await getDb());
  const { derivadas, neo4j } = await reconstruirTodo();
  console.log('Derivadas:', derivadas);
  console.log('Neo4j:', neo4j);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
  });
