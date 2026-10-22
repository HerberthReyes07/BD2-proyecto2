import path from 'node:path';
import dotenv from 'dotenv';

// El .env vive en la raíz del proyecto (tres niveles sobre este archivo: config → src → backend → raíz)
const RAIZ = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(RAIZ, '.env') });

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Copia .env.example a .env y complétala.`);
  return valor;
}

export const env = {
  raiz: RAIZ,
  puerto: Number(process.env.BACKEND_PORT ?? 3000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  mongoDb: process.env.MONGO_DB ?? 'admision_usac',
  neo4jUri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
  neo4jUsuario: process.env.NEO4J_USER ?? 'neo4j',
  neo4jClave: requerida('NEO4J_PASSWORD'),
};
