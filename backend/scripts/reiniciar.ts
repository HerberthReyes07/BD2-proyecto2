/**
 * Deja las dos bases de datos del proyecto VACÍAS: borra las 6 colecciones de MongoDB y todos los nodos y
 * relaciones de Neo4j. Sirve para volver a cargar los CSV desde cero (por ejemplo, después de cambiar una regla del ETL).
 * Los CSV de data/ no se tocan. Es lo mismo que hace el botón «Borrar todos los datos» de la interfaz.
 *
 * Como borra datos, exige la confirmación explícita --si:
 *     npm run reiniciar -- --si
 */
import { cerrarMongo } from '../src/config/mongo';
import { cerrarNeo4j } from '../src/config/neo4j';
import { env } from '../src/config/env';
import { COLECCIONES, reiniciarDatos } from '../src/modules/etl/reiniciar.service';

async function main() {
  if (!process.argv.includes('--si')) {
    console.log(
      `Este comando BORRA los datos de las bases del proyecto:\n` +
        `  - MongoDB "${env.mongoDb}": ${COLECCIONES.join(', ')}\n` +
        `  - Neo4j: todos los nodos y relaciones\n` +
        `Para continuar ejecútalo con la confirmación:  npm run reiniciar -- --si`,
    );
    return;
  }
  const r = await reiniciarDatos();
  console.log(`MongoDB: ${r.mongo.documentos_borrados} documentos borrados (${r.mongo.colecciones_borradas.join(', ') || 'ninguna colección'})`);
  console.log(`Neo4j: ${r.neo4j.nodos_borrados} nodos borrados (con sus relaciones). Las restricciones se conservan.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
  });
