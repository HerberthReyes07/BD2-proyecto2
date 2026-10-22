import { Db } from 'mongodb';
import { getDb } from '../../config/mongo';
import { AppError } from '../../shared/errors/AppError';
import { log } from '../../shared/utils/logger';
import { reconstruirDerivadas, ResumenDerivacion } from './derivar.service';
import { Rechazo, ReporteCarga, ResumenNeo4j } from './etl.types';
import { Entrada, agregarSinDuplicar } from './pipeline/deduplicar';
import { insertarEvaluaciones, insertarRechazos } from './pipeline/loaders/mongo.loader';
import { sincronizarNeo4j } from './pipeline/loaders/neo4j.loader';
import { leerFilas } from './pipeline/reader';
import { transformarFila } from './pipeline/transformer';
import { validarFila } from './pipeline/validator';

export interface ArchivoEntrada {
  ruta: string;
  nombre: string;
}

export interface ResultadoCargas {
  archivos: ReporteCarga[];
  derivadas: ResumenDerivacion | null;
  neo4j: ResumenNeo4j;
}

const contar = (conteo: Record<string, number>, clave: string) => {
  conteo[clave] = (conteo[clave] ?? 0) + 1;
};

/**
 * Procesa UN archivo: lee, valida, transforma, quita duplicados y carga en MongoDB.
 * Deja registro en `cargas` y `rechazados`. Un error del archivo (encabezados inválidos, etc.) lo marca
 * como FALLIDA pero no detiene a los demás archivos.
 */
export async function procesarArchivo(db: Db, archivo: ArchivoEntrada): Promise<ReporteCarga> {
  const inicio = Date.now();
  const reporte: ReporteCarga = {
    archivo: archivo.nombre,
    iniciada_en: new Date(),
    finalizada_en: null,
    duracion_ms: 0,
    estado: 'EN_PROCESO',
    leidos: 0,
    cargados: 0,
    rechazados: 0,
    omitidos: 0,
    rechazos_por_causa: {},
    advertencias_por_tipo: {},
    neo4j: null,
    error: null,
  };
  const { insertedId } = await db.collection('cargas').insertOne({ ...reporte });
  reporte._id = insertedId;

  try {
    const anioArchivo = /(\d{4})/.exec(archivo.nombre)?.[1];
    const contexto = { archivo: archivo.nombre, anioArchivo: anioArchivo ? Number(anioArchivo) : null };

    const unicas = new Map<string, Entrada>();
    const rechazos: Rechazo[] = [];

    for await (const item of leerFilas(archivo.ruta)) {
      reporte.leidos++;
      if (item.tipo === 'rota') {
        const valores = Object.fromEntries(item.crudo.map((v, i) => [`columna_${i + 1}`, v]));
        rechazos.push({ linea: item.linea, causa: 'ESTRUCTURA_INVALIDA', detalle: item.detalle, valores_originales: valores });
        continue;
      }
      const validacion = validarFila(item.valores);
      if (!validacion.ok) {
        rechazos.push({ linea: item.linea, causa: validacion.causa, detalle: validacion.detalle, valores_originales: item.valores });
        continue;
      }
      const doc = transformarFila(validacion.fila, { ...contexto, linea: item.linea });
      const duplicado = agregarSinDuplicar(unicas, { doc, valores: item.valores });
      if (duplicado) rechazos.push(duplicado);
    }

    const docs = [...unicas.values()].map((e) => e.doc);
    for (const d of docs) for (const a of d.advertencias) contar(reporte.advertencias_por_tipo, a);
    for (const r of rechazos) contar(reporte.rechazos_por_causa, r.causa);

    const { insertados, omitidos } = await insertarEvaluaciones(db, docs);
    await insertarRechazos(db, insertedId, archivo.nombre, rechazos);

    reporte.cargados = insertados;
    reporte.omitidos = omitidos;
    reporte.rechazados = rechazos.length;
    reporte.estado = rechazos.length > 0 ? 'COMPLETADA_CON_ERRORES' : 'COMPLETADA';
  } catch (err) {
    reporte.estado = 'FALLIDA';
    reporte.error = err instanceof AppError ? `${err.codigo}: ${err.message}` : (err as Error).message;
    log.error(`Falló la carga de ${archivo.nombre}:`, reporte.error);
  }

  reporte.finalizada_en = new Date();
  reporte.duracion_ms = Date.now() - inicio;
  const { _id, ...resto } = reporte;
  await db.collection('cargas').updateOne({ _id: insertedId }, { $set: resto });
  log.info(
    `${archivo.nombre}: ${reporte.estado} · leídos ${reporte.leidos} · cargados ${reporte.cargados} · ` +
      `rechazados ${reporte.rechazados} · omitidos ${reporte.omitidos} · ${reporte.duracion_ms} ms`,
  );
  return reporte;
}

/**
 * Carga uno o varios archivos y, si entraron datos nuevos, reconstruye las colecciones derivadas y
 * sincroniza Neo4j UNA vez al final (el estado de un aspirante depende de todos sus años).
 */
export async function cargarArchivos(archivos: ArchivoEntrada[]): Promise<ResultadoCargas> {
  if (archivos.length === 0) throw new AppError(400, 'SIN_ARCHIVOS', 'No se recibió ningún archivo CSV.');
  const db = await getDb();

  const reportes: ReporteCarga[] = [];
  for (const archivo of archivos) reportes.push(await procesarArchivo(db, archivo));

  const hayDatosNuevos = reportes.some((r) => r.cargados > 0);
  let derivadas: ResumenDerivacion | null = null;
  let neo4j: ResumenNeo4j = { estado: 'OMITIDA', nodos_creados: 0, relaciones_creadas: 0, duracion_ms: 0 };

  if (hayDatosNuevos) {
    log.info('Reconstruyendo colecciones derivadas...');
    derivadas = await reconstruirDerivadas(db);
    log.info('Sincronizando Neo4j...');
    neo4j = await sincronizarNeo4j(db);
    log.info(`Neo4j: ${neo4j.estado} · nodos ${neo4j.nodos_creados} · relaciones ${neo4j.relaciones_creadas} · ${neo4j.duracion_ms} ms`);
  }

  // El resultado de Neo4j se guarda en cada carga de esta solicitud
  const ids = reportes.map((r) => r._id!);
  const fallaNeo4j = neo4j.estado === 'FALLIDA';
  await db.collection('cargas').updateMany({ _id: { $in: ids } }, { $set: { neo4j } });
  for (const r of reportes) {
    r.neo4j = neo4j;
    if (fallaNeo4j && r.estado === 'COMPLETADA') {
      r.estado = 'COMPLETADA_CON_ERRORES';
      await db.collection('cargas').updateOne({ _id: r._id }, { $set: { estado: r.estado } });
    }
  }
  return { archivos: reportes, derivadas, neo4j };
}

/** Reconstruye derivadas y Neo4j sin cargar archivos (útil si una sincronización anterior falló). */
export async function reconstruirTodo(): Promise<{ derivadas: ResumenDerivacion; neo4j: ResumenNeo4j }> {
  const db = await getDb();
  const derivadas = await reconstruirDerivadas(db);
  const neo4j = await sincronizarNeo4j(db);
  return { derivadas, neo4j };
}
