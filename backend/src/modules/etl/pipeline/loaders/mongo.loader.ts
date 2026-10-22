import { Db, MongoBulkWriteError, ObjectId } from 'mongodb';
import { EvaluacionDoc, Rechazo } from '../../etl.types';

const TAM_LOTE = 5000;

/**
 * Inserta las evaluaciones en lotes. La clave natural es el _id: si una evaluación ya existe, MongoDB lanza
 * un error de clave repetida (código 11000) que aquí se cuenta como "omitida" (R-D2) en vez de fallar.
 * Con ordered:false, un error no detiene el resto del lote.
 */
export async function insertarEvaluaciones(db: Db, docs: EvaluacionDoc[]): Promise<{ insertados: number; omitidos: number }> {
  const coleccion = db.collection<EvaluacionDoc>('evaluaciones');
  let insertados = 0;
  let omitidos = 0;
  for (let i = 0; i < docs.length; i += TAM_LOTE) {
    const lote = docs.slice(i, i + TAM_LOTE);
    try {
      const r = await coleccion.insertMany(lote, { ordered: false });
      insertados += r.insertedCount;
    } catch (err) {
      if (!(err instanceof MongoBulkWriteError)) throw err;
      const errores = Array.isArray(err.writeErrors) ? err.writeErrors : [err.writeErrors];
      const repetidos = errores.filter((e) => e.code === 11000).length;
      if (repetidos !== errores.length) throw err; // otro tipo de error: no se oculta
      insertados += err.result.insertedCount;
      omitidos += repetidos;
    }
  }
  return { insertados, omitidos };
}

export async function insertarRechazos(db: Db, cargaId: ObjectId, archivo: string, rechazos: Rechazo[]): Promise<void> {
  if (rechazos.length === 0) return;
  const ahora = new Date();
  const docs = rechazos.map((r) => ({
    carga_id: cargaId,
    archivo,
    linea: r.linea,
    causa: r.causa,
    detalle: r.detalle,
    valores_originales: r.valores_originales,
    registrado_en: ahora,
  }));
  for (let i = 0; i < docs.length; i += TAM_LOTE) {
    await db.collection('rechazados').insertMany(docs.slice(i, i + TAM_LOTE));
  }
}
