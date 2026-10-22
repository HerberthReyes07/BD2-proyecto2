import { Db, MongoClient } from 'mongodb';
import { env } from './env';
import { AppError } from '../shared/errors/AppError';

let cliente: MongoClient | null = null;
let db: Db | null = null;

/**
 * Devuelve la base de datos, conectando la primera vez. Si MongoDB no responde se lanza un AppError 503
 * (el servidor sigue vivo y la API responde con un mensaje claro).
 */
export async function getDb(): Promise<Db> {
  if (db) return db;
  try {
    const nuevo = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 3000 });
    await nuevo.connect();
    await nuevo.db(env.mongoDb).command({ ping: 1 });
    cliente = nuevo;
    db = nuevo.db(env.mongoDb);
    return db;
  } catch (err) {
    cliente = null;
    db = null;
    throw new AppError(503, 'MONGO_NO_DISPONIBLE', 'No se pudo conectar con MongoDB. Verifica que el contenedor esté en ejecución.', (err as Error).message);
  }
}

export async function mongoDisponible(): Promise<boolean> {
  try {
    const base = await getDb();
    await base.command({ ping: 1 });
    return true;
  } catch {
    // Si la conexión se cayó después de establecerse, se descarta para reintentar en la siguiente petición
    cliente = null;
    db = null;
    return false;
  }
}

export async function cerrarMongo(): Promise<void> {
  await cliente?.close();
  cliente = null;
  db = null;
}
