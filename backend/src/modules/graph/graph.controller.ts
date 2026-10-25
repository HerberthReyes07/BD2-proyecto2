import { Request, Response } from 'express';
import {
  catalogos,
  ejecutarConsultaCypher,
  listarConsultasCypher,
  mapaDemanda,
  redAspirante,
  resumenGrafo,
} from './graph.service';

export function listar(_req: Request, res: Response): void {
  res.json(listarConsultasCypher());
}

/** GET /api/graph/consultas/:id — ejecuta una consulta Cypher (g01 a g06); parámetros en la URL. */
export async function ejecutar(req: Request, res: Response): Promise<void> {
  res.json(await ejecutarConsultaCypher(String(req.params.id), req.query));
}

/** GET /api/graph/catalogos — valores para llenar los filtros (departamentos, carreras, años...). */
export async function obtenerCatalogos(_req: Request, res: Response): Promise<void> {
  res.json(await catalogos());
}

/** GET /api/graph/resumen — cuántos nodos y relaciones hay de cada tipo. */
export async function obtenerResumen(_req: Request, res: Response): Promise<void> {
  res.json(await resumenGrafo());
}

/** GET /api/graph/mapa-demanda — subgrafo Departamento–Municipio–Carrera, filtrable por año, departamento y aprobados. */
export async function obtenerMapaDemanda(req: Request, res: Response): Promise<void> {
  res.json(await mapaDemanda(req.query));
}

/** GET /api/graph/aspirante/:id — red de un aspirante: sus postulaciones, carreras, lugares y evaluaciones. */
export async function obtenerRedAspirante(req: Request, res: Response): Promise<void> {
  res.json(await redAspirante(String(req.params.id)));
}
