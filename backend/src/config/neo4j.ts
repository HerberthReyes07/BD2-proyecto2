import neo4j, { Driver, Integer, Session } from 'neo4j-driver';
import { env } from './env';
import { AppError } from '../shared/errors/AppError';

let driver: Driver | null = null;

/** Crea el driver la primera vez. Los enteros de Neo4j se devuelven como números normales de JavaScript. */
export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(env.neo4jUri, neo4j.auth.basic(env.neo4jUsuario, env.neo4jClave), {
      disableLosslessIntegers: true,
      // Si Neo4j no responde, fallar rápido (por defecto el driver reintenta 30 s y la interfaz parecería colgada)
      maxTransactionRetryTime: 3000,
      connectionTimeout: 3000,
      connectionAcquisitionTimeout: 5000,
    });
  }
  return driver;
}

/** Ejecuta una función con una sesión y la cierra al terminar. Traduce los errores de conexión a un AppError 503. */
export async function conSesion<T>(fn: (sesion: Session) => Promise<T>): Promise<T> {
  const sesion = getDriver().session();
  try {
    return await fn(sesion);
  } catch (err) {
    const e = err as { code?: string; message: string };
    if (e.code?.includes('ServiceUnavailable') || e.code?.includes('SessionExpired') || e.code?.includes('Unauthorized')) {
      throw new AppError(503, 'NEO4J_NO_DISPONIBLE', 'No se pudo conectar con Neo4j. Verifica el contenedor y las credenciales.', e.message);
    }
    throw err;
  } finally {
    await sesion.close();
  }
}

export async function neo4jDisponible(): Promise<boolean> {
  try {
    await getDriver().getServerInfo();
    return true;
  } catch {
    return false;
  }
}

/** Convierte un entero de JavaScript en un Integer de Neo4j (por defecto los números se enviarían como Float). */
export function entero(n: number | null | undefined): Integer | null {
  return n === null || n === undefined ? null : neo4j.int(n);
}

export async function cerrarNeo4j(): Promise<void> {
  await driver?.close();
  driver = null;
}
