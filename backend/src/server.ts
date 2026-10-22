import { crearApp } from './app';
import { env } from './config/env';
import { cerrarMongo, getDb } from './config/mongo';
import { cerrarNeo4j } from './config/neo4j';
import { crearIndicesMongo } from './db/mongo.indexes';
import { crearRestriccionesNeo4j } from './db/neo4j.constraints';
import { log } from './shared/utils/logger';

async function main() {
  // Si una base de datos no está disponible al arrancar, el servidor igual inicia: la API responde con
  // errores claros (503) y /api/health informa el estado. Los índices se crean cuando haya conexión.
  try {
    await crearIndicesMongo(await getDb());
    log.info('MongoDB conectado e índices listos.');
  } catch (err) {
    log.warn('MongoDB no está disponible todavía:', (err as Error).message);
  }
  try {
    await crearRestriccionesNeo4j();
    log.info('Neo4j conectado y restricciones listas.');
  } catch (err) {
    log.warn('Neo4j no está disponible todavía:', (err as Error).message);
  }

  const servidor = crearApp().listen(env.puerto, () => log.info(`API escuchando en http://localhost:${env.puerto}`));

  const cerrar = async () => {
    servidor.close();
    await Promise.allSettled([cerrarMongo(), cerrarNeo4j()]);
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((err) => {
  log.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
