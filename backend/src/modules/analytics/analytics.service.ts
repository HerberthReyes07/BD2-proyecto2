import { Document } from 'mongodb';
import { getDb } from '../../config/mongo';
import { AppError } from '../../shared/errors/AppError';
import { ConsultaMongo, ParametroDef } from './analytics.types';
import { CONSULTAS, buscarConsulta } from './queries';
import { PARAM_ANIO, leerParametros } from './queries/comun';

/** Datos de una consulta que el frontend necesita (sin las funciones). */
function describir(c: ConsultaMongo) {
  return {
    id: c.id,
    numero: c.numero,
    titulo: c.titulo,
    descripcion: c.descripcion,
    explicacion: c.explicacion,
    coleccion: c.coleccion,
    grafica: c.grafica,
    ejes: c.ejes ?? null,
    parametros: parametrosDe(c),
  };
}

const parametrosDe = (c: ConsultaMongo): ParametroDef[] => [...(c.filtroAnio ? [PARAM_ANIO] : []), ...c.parametros];

export function listarConsultas() {
  return CONSULTAS.map(describir);
}

/** Cifras generales para las tarjetas del dashboard. */
export async function resumenGeneral() {
  const db = await getDb();
  const [evaluaciones, postulaciones, aspirantes, aprobados, aprobadosEnElAnio, anios, rechazados] = await Promise.all([
    db.collection('evaluaciones').countDocuments(),
    db.collection('postulaciones').countDocuments(),
    db.collection('aspirantes').countDocuments(),
    db.collection('postulaciones').countDocuments({ aprobado: true }),
    db.collection('postulaciones').countDocuments({ aprobo_ambas_en_el_anio: true }),
    db.collection('postulaciones').distinct('anio_ingreso'),
    db.collection('rechazados').countDocuments(),
  ]);
  const ordenados = (anios as number[]).sort((a, b) => a - b);
  return {
    evaluaciones,
    postulaciones,
    aspirantes,
    aprobados,
    aprobados_en_el_anio: aprobadosEnElAnio,
    rechazados,
    anio_inicial: ordenados[0] ?? null,
    anio_final: ordenados[ordenados.length - 1] ?? null,
  };
}

/** Ejecuta una consulta con los parámetros recibidos en la URL y devuelve las filas junto con el pipeline usado. */
export async function ejecutarConsulta(id: string, entrada: Record<string, unknown>) {
  const consulta = buscarConsulta(id);
  if (!consulta) throw new AppError(404, 'CONSULTA_NO_ENCONTRADA', `No existe la consulta "${id}".`);

  const parametros = leerParametros(parametrosDe(consulta), entrada);
  const db = await getDb();
  const pipeline = consulta.construirPipeline(parametros);

  const inicio = Date.now();
  let filas: Document[];
  try {
    filas = consulta.ejecutar
      ? await consulta.ejecutar(db, parametros)
      : await db.collection(consulta.coleccion).aggregate(pipeline, { maxTimeMS: 30_000 }).toArray();
  } catch (err) {
    if ((err as { codeName?: string }).codeName === 'MaxTimeMSExpired') {
      throw new AppError(504, 'CONSULTA_LENTA', 'La consulta tardó demasiado y se canceló.');
    }
    throw err;
  }
  if (consulta.vacioEs404 && filas.length === 0) throw new AppError(404, 'SIN_RESULTADOS', consulta.vacioEs404);

  return {
    consulta: describir(consulta),
    parametros,
    filas,
    total_filas: filas.length,
    duracion_ms: Date.now() - inicio,
    pipeline,
  };
}
