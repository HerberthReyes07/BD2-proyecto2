import { Request, Response } from 'express';
import { ejecutarConsulta, listarConsultas } from './analytics.service';

/** GET /api/analytics/consultas — catálogo de las 20 consultas (título, gráfica, parámetros). */
export function listar(_req: Request, res: Response): void {
  res.json(listarConsultas());
}

/** GET /api/analytics/consultas/:id — ejecuta una consulta; los parámetros van en la URL (?anio_ingreso=2019). */
export async function ejecutar(req: Request, res: Response): Promise<void> {
  res.json(await ejecutarConsulta(String(req.params.id), req.query));
}
