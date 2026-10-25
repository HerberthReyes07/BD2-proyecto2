/**
 * Deja las dos bases de datos del proyecto VACÍAS: borra las 6 colecciones de MongoDB y todos los nodos y
 * relaciones de Neo4j. Sirve para volver a cargar los CSV desde cero (por ejemplo, después de cambiar una regla del ETL).
 * Los CSV de data/ no se tocan.
 *
 * Como borra datos, exige la confirmación explícita --si:
 *     npm run reiniciar -- --si
 */
import { cerrarMongo, getDb } from '../src/config/mongo';
import { cerrarNeo4j, conSesion } from '../src/config/neo4j';
import { env } from '../src/config/env';

const COLECCIONES = ['evaluaciones', 'postulaciones', 'aspirantes', 'resumen_carrera', 'cargas', 'rechazados'];

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

  const db = await getDb();
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const nombre of COLECCIONES) {
    if (existentes.has(nombre)) {
      await db.collection(nombre).drop();
      console.log(`MongoDB: colección ${nombre} borrada`);
    }
  }

  // Se borra por lotes de 10,000 nodos para no saturar la memoria de Neo4j con una sola transacción gigante
  let total = 0;
  await conSesion(async (sesion) => {
    for (;;) {
      const r = await sesion.run('MATCH (n) WITH n LIMIT 10000 DETACH DELETE n RETURN count(*) AS borrados');
      const borrados = r.records[0].get('borrados') as number;
      if (borrados === 0) break;
      total += borrados;
    }
  });
  console.log(`Neo4j: ${total} nodos borrados (con sus relaciones). Las restricciones se conservan.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
  });
