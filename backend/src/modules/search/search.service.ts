import { Filter } from 'mongodb';
import { getDb } from '../../config/mongo';
import { AppError } from '../../shared/errors/AppError';
import { PostulacionDoc } from '../etl/etl.types';

const ESTADOS = ['APROBADO', 'YA_HABILITADO', 'PARCIAL', 'NO_APROBADO'];

/** Toma un parámetro de la URL solo si es un texto simple (así no se cuelan operadores como ?carrera[$ne]=x). */
function texto(entrada: Record<string, unknown>, nombre: string, max = 100): string | undefined {
  const v = entrada[nombre];
  if (v === undefined || v === '') return undefined;
  if (typeof v !== 'string' || v.length > max) throw new AppError(400, 'PARAMETRO_INVALIDO', `"${nombre}" no es válido.`);
  return v.trim();
}

function entero(entrada: Record<string, unknown>, nombre: string, min: number, max: number): number | undefined {
  const v = texto(entrada, nombre, 10);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, 'PARAMETRO_INVALIDO', `"${nombre}" debe ser un entero entre ${min} y ${max}.`);
  return n;
}

/**
 * Buscador: filtra las postulaciones (un aspirante en un año de ingreso) por cualquier combinación de criterios.
 * Todos los criterios son opcionales; los que se indican se combinan con AND.
 */
export async function buscarPostulaciones(entrada: Record<string, unknown>) {
  const filtro: Filter<PostulacionDoc> = {};

  const aspirante = texto(entrada, 'aspirante_id', 32)?.toLowerCase();
  if (aspirante !== undefined) {
    if (!/^[0-9a-f]{4,32}$/.test(aspirante)) {
      throw new AppError(400, 'PARAMETRO_INVALIDO', 'El identificador del aspirante son entre 4 y 32 caracteres hexadecimales (0-9, a-f).');
    }
    filtro.aspirante_id = { $regex: `^${aspirante.slice(0, 20)}` }; // búsqueda por prefijo: usa el índice
  }
  const carrera = texto(entrada, 'carrera');
  if (carrera) filtro.carreras = carrera;
  const tipo = texto(entrada, 'tipo_institucion');
  if (tipo) filtro.tipo_institucion = tipo;
  const departamento = texto(entrada, 'departamento');
  if (departamento) filtro.departamento = departamento;
  const municipio = texto(entrada, 'municipio');
  if (municipio) filtro.municipio = municipio;
  const materia = texto(entrada, 'materia');
  if (materia) filtro['materias.materia'] = materia;
  const anio = entero(entrada, 'anio_ingreso', 2000, 2100);
  if (anio !== undefined) filtro.anio_ingreso = anio;
  const estado = texto(entrada, 'estado');
  if (estado) {
    if (!ESTADOS.includes(estado)) throw new AppError(400, 'PARAMETRO_INVALIDO', `"estado" debe ser uno de: ${ESTADOS.join(', ')}.`);
    filtro.estado = estado as PostulacionDoc['estado'];
  }
  const edadMin = entero(entrada, 'edad_min', 13, 70);
  const edadMax = entero(entrada, 'edad_max', 13, 70);
  if (edadMin !== undefined || edadMax !== undefined) {
    filtro.edad = { ...(edadMin !== undefined ? { $gte: edadMin } : {}), ...(edadMax !== undefined ? { $lte: edadMax } : {}) };
  }

  const porPagina = entero(entrada, 'por_pagina', 1, 100) ?? 25;
  const pagina = entero(entrada, 'pagina', 1, 100000) ?? 1;

  const db = await getDb();
  const coleccion = db.collection<PostulacionDoc>('postulaciones');
  const inicio = Date.now();
  const [total, filas] = await Promise.all([
    coleccion.countDocuments(filtro),
    coleccion
      .find(filtro, {
        projection: {
          aspirante_id: 1, anio_ingreso: 1, edad: 1, sexo: 1, carreras: 1, departamento: 1, municipio: 1,
          zona: 1, tipo_institucion: 1, estado: 1, n_evaluaciones: 1, materias: 1,
        },
      })
      .sort({ aspirante_id: 1, anio_ingreso: 1 })
      .skip((pagina - 1) * porPagina)
      .limit(porPagina)
      .toArray(),
  ]);
  return { total, pagina, por_pagina: porPagina, total_paginas: Math.max(1, Math.ceil(total / porPagina)), duracion_ms: Date.now() - inicio, filas };
}

/** Valores para llenar las listas desplegables de los filtros (se leen de MongoDB, no dependen de Neo4j). */
export async function catalogosBusqueda() {
  const db = await getDb();
  const post = db.collection('postulaciones');
  const limpiar = (v: unknown[]) => (v as (string | number | null)[]).filter((x) => x !== null && x !== undefined).sort();
  const [carreras, tipos, departamentos, anios, lugares] = await Promise.all([
    post.distinct('carreras'),
    post.distinct('tipo_institucion'),
    post.distinct('departamento'),
    post.distinct('anio_ingreso'),
    post
      .aggregate<{ departamento: string; municipio: string }>([
        { $match: { departamento: { $ne: null }, municipio: { $ne: null } } },
        { $group: { _id: { departamento: '$departamento', municipio: '$municipio' } } },
        { $project: { _id: 0, departamento: '$_id.departamento', municipio: '$_id.municipio' } },
        { $sort: { departamento: 1, municipio: 1 } },
      ])
      .toArray(),
  ]);
  return {
    carreras: limpiar(carreras.filter((c) => typeof c === 'string')),
    tipos: limpiar(tipos),
    departamentos: limpiar(departamentos),
    anios: limpiar(anios),
    materias: ['COMPUTACION', 'MATEMATICA'],
    estados: ESTADOS,
    municipios: lugares,
  };
}
