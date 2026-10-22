import fs from 'node:fs/promises';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../../config/mongo';
import { AppError } from '../../shared/errors/AppError';
import { cargarArchivos, reconstruirTodo } from './etl.service';

/** POST /api/etl/cargas — recibe uno o varios CSV (campo "archivos") y devuelve el reporte de cada uno. */
export async function crearCargas(req: Request, res: Response): Promise<void> {
  const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const resultado = await cargarArchivos(archivos.map((f) => ({ ruta: f.path, nombre: f.originalname })));
    res.status(201).json(resultado);
  } finally {
    await Promise.all(archivos.map((f) => fs.rm(f.path, { force: true })));
  }
}

/** GET /api/etl/cargas — historial de cargas, de la más reciente a la más antigua. */
export async function listarCargas(_req: Request, res: Response): Promise<void> {
  const db = await getDb();
  const cargas = await db.collection('cargas').find().sort({ iniciada_en: -1 }).limit(100).toArray();
  res.json(cargas);
}

/** GET /api/etl/cargas/:id/rechazados?limite=&salto= — filas rechazadas de una carga, con su causa. */
export async function listarRechazados(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  if (!ObjectId.isValid(id)) throw new AppError(400, 'ID_INVALIDO', 'El identificador de carga no es válido.');
  const limite = Math.min(Number(req.query.limite ?? 100) || 100, 1000);
  const salto = Number(req.query.salto ?? 0) || 0;
  const filtro: Record<string, unknown> = { carga_id: new ObjectId(id) };
  if (typeof req.query.causa === 'string') filtro.causa = req.query.causa;

  const db = await getDb();
  const coleccion = db.collection('rechazados');
  const [total, filas] = await Promise.all([
    coleccion.countDocuments(filtro),
    coleccion.find(filtro).sort({ linea: 1 }).skip(salto).limit(limite).toArray(),
  ]);
  res.json({ total, filas });
}

/** POST /api/etl/reconstruir — recalcula colecciones derivadas y Neo4j sin cargar archivos nuevos. */
export async function reconstruir(_req: Request, res: Response): Promise<void> {
  res.json(await reconstruirTodo());
}
