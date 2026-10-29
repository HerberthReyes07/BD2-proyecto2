import {
  CatalogosBusqueda,
  CatalogosGrafo,
  ConsultaMeta,
  Grafo,
  Rechazado,
  ReporteCarga,
  ResultadoBusqueda,
  ResultadoCargas,
  ResultadoConsulta,
  ResultadoReinicio,
  ResumenGeneral,
} from '../types/api';
import { pedir, queryString } from './client';

type Params = Record<string, unknown>;

/** Consulta el estado de las dos bases de datos. /api/health responde 503 cuando alguna está caída; aquí se lee igual. */
export async function estadoBases(): Promise<{ mongo: boolean; neo4j: boolean; servidor: boolean }> {
  try {
    const r = await fetch('/api/health');
    const cuerpo = (await r.json()) as { mongo: boolean; neo4j: boolean };
    return { ...cuerpo, servidor: true };
  } catch {
    return { mongo: false, neo4j: false, servidor: false };
  }
}

// ---- Carga de archivos (ETL) ----
export const subirArchivos = (archivos: File[]) => {
  const datos = new FormData();
  archivos.forEach((a) => datos.append('archivos', a));
  return pedir<ResultadoCargas>('/etl/cargas', { method: 'POST', body: datos });
};
export const listarCargas = () => pedir<ReporteCarga[]>('/etl/cargas');
export const listarRechazados = (id: string, params: Params = {}) =>
  pedir<{ total: number; filas: Rechazado[] }>(`/etl/cargas/${id}/rechazados${queryString(params)}`);

/** Borra TODOS los datos cargados (MongoDB y Neo4j). La confirmación va en la URL: el backend la exige. */
export const borrarDatos = () => pedir<ResultadoReinicio>('/etl/datos?confirmar=si', { method: 'DELETE' });

// ---- Consultas de MongoDB ----
export const resumenGeneral = () => pedir<ResumenGeneral>('/analytics/resumen');
export const consultasMongo = () => pedir<ConsultaMeta[]>('/analytics/consultas');
export const ejecutarMongo = (id: string, params: Params = {}) =>
  pedir<ResultadoConsulta>(`/analytics/consultas/${id}${queryString(params)}`);

// ---- Neo4j ----
export const consultasCypher = () => pedir<ConsultaMeta[]>('/graph/consultas');
export const ejecutarCypher = (id: string, params: Params = {}) =>
  pedir<ResultadoConsulta>(`/graph/consultas/${id}${queryString(params)}`);
export const catalogosGrafo = () => pedir<CatalogosGrafo>('/graph/catalogos');
export const mapaDemanda = (params: Params = {}) =>
  pedir<{ grafo: Grafo; duracion_ms: number; cypher: string }>(`/graph/mapa-demanda${queryString(params)}`);
export const redAspirante = (id: string) =>
  pedir<{ aspirante_id: string; grafo: Grafo; duracion_ms: number; cypher: string }>(`/graph/aspirante/${encodeURIComponent(id)}`);

// ---- Buscador ----
export const buscar = (params: Params = {}) => pedir<ResultadoBusqueda>(`/search/postulaciones${queryString(params)}`);
export const catalogosBusqueda = () => pedir<CatalogosBusqueda>('/search/catalogos');
