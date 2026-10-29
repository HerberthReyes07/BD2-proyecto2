import { getDb, mongoDisponible } from '../../config/mongo';
import { conSesion, neo4jDisponible } from '../../config/neo4j';
import { crearIndicesMongo } from '../../db/mongo.indexes';
import { AppError } from '../../shared/errors/AppError';
import { log } from '../../shared/utils/logger';
import { conBloqueo } from './bloqueo';

/** Las 6 colecciones del proyecto (docs/modelo-mongodb.md). */
export const COLECCIONES = ['evaluaciones', 'postulaciones', 'aspirantes', 'resumen_carrera', 'cargas', 'rechazados'];

export interface ResultadoReinicio {
  mongo: { colecciones_borradas: string[]; documentos_borrados: number };
  neo4j: { nodos_borrados: number };
  duracion_ms: number;
}

/**
 * Deja las dos bases de datos del proyecto VACÍAS: borra las 6 colecciones de MongoDB y todos los nodos y relaciones
 * de Neo4j. Los CSV originales no se tocan, así que se puede volver a cargar desde cero.
 *
 * Exige que AMBAS bases respondan antes de empezar: si una estuviera caída, la otra se borraría y quedarían en estados distintos.
 */
export function reiniciarDatos(): Promise<ResultadoReinicio> {
  return conBloqueo('limpieza de datos', async () => {
    const inicio = Date.now();
    const [mongoOk, neo4jOk] = await Promise.all([mongoDisponible(), neo4jDisponible()]);
    if (!mongoOk || !neo4jOk) {
      const caidas = [!mongoOk && 'MongoDB', !neo4jOk && 'Neo4j'].filter(Boolean).join(' y ');
      throw new AppError(
        503,
        'BASES_NO_DISPONIBLES',
        `No se pueden borrar los datos porque ${caidas} no responde. Ambas bases deben estar disponibles para que queden en el mismo estado.`,
      );
    }

    // MongoDB: se cuentan los documentos y se borran las colecciones
    const db = await getDb();
    const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    const borradas: string[] = [];
    let documentos = 0;
    for (const nombre of COLECCIONES) {
      if (!existentes.has(nombre)) continue;
      documentos += await db.collection(nombre).countDocuments();
      await db.collection(nombre).drop();
      borradas.push(nombre);
    }
    // Al borrar una colección se pierden sus índices: se recrean para que la próxima carga sea igual de rápida
    await crearIndicesMongo(db);

    // Neo4j: se borra por lotes de 10,000 nodos para no saturar la memoria con una sola transacción enorme.
    // Las restricciones de unicidad se conservan.
    let nodos = 0;
    await conSesion(async (sesion) => {
      for (;;) {
        const r = await sesion.run('MATCH (n) WITH n LIMIT 10000 DETACH DELETE n RETURN count(*) AS borrados');
        const borrados = r.records[0].get('borrados') as number;
        if (borrados === 0) break;
        nodos += borrados;
      }
    });

    const resultado = { mongo: { colecciones_borradas: borradas, documentos_borrados: documentos }, neo4j: { nodos_borrados: nodos }, duracion_ms: Date.now() - inicio };
    log.info(`Datos borrados: ${documentos} documentos de MongoDB y ${nodos} nodos de Neo4j en ${resultado.duracion_ms} ms`);
    return resultado;
  });
}
