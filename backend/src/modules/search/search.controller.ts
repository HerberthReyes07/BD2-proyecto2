import { Request, Response } from 'express';
import { buscarPostulaciones, catalogosBusqueda } from './search.service';

/** GET /api/search/postulaciones — búsqueda con filtros y paginación. */
export async function buscar(req: Request, res: Response): Promise<void> {
  res.json(await buscarPostulaciones(req.query));
}

/** GET /api/search/catalogos — valores para las listas desplegables del buscador. */
export async function catalogos(_req: Request, res: Response): Promise<void> {
  res.json(await catalogosBusqueda());
}
