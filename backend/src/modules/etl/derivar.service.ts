import { AnyBulkWriteOperation, Db } from 'mongodb';
import { crearResumenCarrera } from '../analytics/queries/q06-resumen-carrera';
import { derivarPersona } from './pipeline/aprobacion';
import { AspiranteDoc, EvaluacionDoc, PostulacionDoc } from './etl.types';

const TAM_LOTE = 1000;

export interface ResumenDerivacion {
  aspirantes: number;
  postulaciones: number;
  por_estado: Record<string, number>;
  aprobo_ambas_en_el_anio: number;
  carreras_en_resumen: number;
  duracion_ms: number;
}

/**
 * Reconstruye las colecciones derivadas `aspirantes`, `postulaciones` y `resumen_carrera` a partir de
 * `evaluaciones` (docs/modelo-mongodb.md §10, paso 3). Se reconstruyen COMPLETAS porque cargar un archivo
 * nuevo puede cambiar el estado de aprobación de aspirantes de años anteriores.
 *
 * Se leen las evaluaciones ordenadas por aspirante (índice aspirante_id, anio_ingreso, oportunidad), de modo que
 * basta ir juntando las filas consecutivas de la misma persona y calcular sus documentos en memoria.
 */
export async function reconstruirDerivadas(db: Db): Promise<ResumenDerivacion> {
  const t0 = Date.now();
  const evaluaciones = db.collection<EvaluacionDoc>('evaluaciones');
  const colAspirantes = db.collection<AspiranteDoc>('aspirantes');
  const colPostulaciones = db.collection<PostulacionDoc>('postulaciones');

  const opsAspirantes: AnyBulkWriteOperation<AspiranteDoc>[] = [];
  const opsPostulaciones: AnyBulkWriteOperation<PostulacionDoc>[] = [];
  const resumen: ResumenDerivacion = {
    aspirantes: 0,
    postulaciones: 0,
    por_estado: {},
    aprobo_ambas_en_el_anio: 0,
    carreras_en_resumen: 0,
    duracion_ms: 0,
  };

  const volcar = async (forzar: boolean) => {
    if (opsAspirantes.length >= TAM_LOTE || (forzar && opsAspirantes.length > 0)) {
      await colAspirantes.bulkWrite(opsAspirantes.splice(0), { ordered: false });
    }
    if (opsPostulaciones.length >= TAM_LOTE || (forzar && opsPostulaciones.length > 0)) {
      await colPostulaciones.bulkWrite(opsPostulaciones.splice(0), { ordered: false });
    }
  };

  const procesarPersona = async (evs: EvaluacionDoc[]) => {
    const { aspirante, postulaciones } = derivarPersona(evs);
    opsAspirantes.push({ replaceOne: { filter: { _id: aspirante._id }, replacement: aspirante, upsert: true } });
    resumen.aspirantes++;
    for (const p of postulaciones) {
      opsPostulaciones.push({ replaceOne: { filter: { _id: p._id }, replacement: p, upsert: true } });
      resumen.postulaciones++;
      resumen.por_estado[p.estado] = (resumen.por_estado[p.estado] ?? 0) + 1;
      if (p.aprobo_ambas_en_el_anio) resumen.aprobo_ambas_en_el_anio++;
    }
    await volcar(false);
  };

  const cursor = evaluaciones.find().sort({ aspirante_id: 1, anio_ingreso: 1, oportunidad: 1 }).batchSize(5000);
  let actual: EvaluacionDoc[] = [];
  for await (const ev of cursor) {
    if (actual.length > 0 && actual[0].aspirante_id !== ev.aspirante_id) {
      await procesarPersona(actual);
      actual = [];
    }
    actual.push(ev);
  }
  if (actual.length > 0) await procesarPersona(actual);
  await volcar(true);

  // Consulta 6: el resumen por carrera sale de `postulaciones` ya reconstruida
  resumen.carreras_en_resumen = await crearResumenCarrera(db);
  resumen.duracion_ms = Date.now() - t0;
  return resumen;
}
