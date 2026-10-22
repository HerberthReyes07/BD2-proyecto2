/**
 * Carga por línea de comandos: mismo proceso que el botón "Cargar archivos" de la interfaz.
 *
 * Uso: npm run load -- [archivo.csv ...]      (sin argumentos carga todos los CSV de ../data en orden)
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { cerrarMongo, getDb } from '../src/config/mongo';
import { cerrarNeo4j } from '../src/config/neo4j';
import { crearIndicesMongo } from '../src/db/mongo.indexes';
import { cargarArchivos } from '../src/modules/etl/etl.service';

async function main() {
  const dataDir = path.resolve(__dirname, '../../data');
  const rutas =
    process.argv.length > 2
      ? process.argv.slice(2).map((r) => path.resolve(r))
      : readdirSync(dataDir)
          .filter((f) => f.toLowerCase().endsWith('.csv'))
          .sort()
          .map((f) => path.join(dataDir, f));

  await crearIndicesMongo(await getDb());
  const resultado = await cargarArchivos(rutas.map((ruta) => ({ ruta, nombre: path.basename(ruta) })));

  console.log('\n=== Resumen ===');
  console.table(
    resultado.archivos.map((a) => ({
      archivo: a.archivo,
      estado: a.estado,
      leidos: a.leidos,
      cargados: a.cargados,
      rechazados: a.rechazados,
      omitidos: a.omitidos,
      ms: a.duracion_ms,
    })),
  );
  console.log('Derivadas:', resultado.derivadas);
  console.log('Neo4j:', resultado.neo4j);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
  });
