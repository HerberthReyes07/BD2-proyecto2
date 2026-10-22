import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError';
import { log } from '../utils/logger';

/** Permite escribir handlers async en Express 4 sin que un error no capturado tumbe la petición. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/**
 * Último middleware: convierte cualquier error en una respuesta JSON clara. El servidor nunca se cae
 * por un error de una petición.
 */
export function manejarErrores(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.estado).json({ error: { codigo: err.codigo, mensaje: err.message, detalle: err.detalle } });
    return;
  }
  if (err instanceof multer.MulterError) {
    const mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido (100 MB).' : err.message;
    res.status(400).json({ error: { codigo: err.code, mensaje } });
    return;
  }
  const e = err as { name?: string; message?: string };
  if (e?.name === 'MongoServerSelectionError' || e?.name === 'MongoNetworkError') {
    res.status(503).json({ error: { codigo: 'MONGO_NO_DISPONIBLE', mensaje: 'No se pudo conectar con MongoDB.' } });
    return;
  }
  log.error('Error no controlado:', err);
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado en el servidor.' } });
}
