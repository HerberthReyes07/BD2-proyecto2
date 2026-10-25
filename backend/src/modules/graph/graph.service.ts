import neo4j, { Node, Relationship } from 'neo4j-driver';
import { conSesion, entero } from '../../config/neo4j';
import { AppError } from '../../shared/errors/AppError';
import { ParametroDef } from '../analytics/analytics.types';
import { PARAM_ANIO, leerParametros } from '../analytics/queries/comun';
import { CONSULTAS_CYPHER, buscarConsultaCypher } from './cypher';
import { AristaGrafo, ConsultaCypher, Grafo, NodoGrafo } from './graph.types';

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Convierte lo que devuelve el driver (nodos, fechas...) en JSON simple. */
function aPlano(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (neo4j.isInt(valor)) return (valor as { toNumber(): number }).toNumber();
  if (neo4j.isDate(valor) || neo4j.isDateTime(valor) || neo4j.isLocalDateTime(valor)) return String(valor);
  if (Array.isArray(valor)) return valor.map(aPlano);
  if (valor instanceof Node) return { _tipo: valor.labels[0], ...(aPlano(valor.properties) as object) };
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aPlano(v)]));
  }
  return valor;
}

/** Los enteros deben enviarse como Integer de Neo4j: un número de JavaScript viajaría como decimal y LIMIT lo rechazaría. */
function prepararParametros(defs: ParametroDef[], valores: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const def of defs) {
    const v = valores[def.nombre];
    salida[def.nombre] = v === undefined ? null : def.tipo === 'entero' ? entero(v as number) : v;
  }
  return salida;
}

async function leer(cypher: string, params: Record<string, unknown> = {}) {
  return conSesion((sesion) => sesion.executeRead((tx) => tx.run(cypher, params), { timeout: 30_000 }));
}

// ---------------------------------------------------------------------------------------------
// Consultas Cypher del proyecto (g01 a g06)
// ---------------------------------------------------------------------------------------------

function describir(c: ConsultaCypher) {
  const { preparar: _preparar, ...resto } = c;
  return resto;
}

export function listarConsultasCypher() {
  return CONSULTAS_CYPHER.map(describir);
}

export async function ejecutarConsultaCypher(id: string, entrada: Record<string, unknown>) {
  const consulta = buscarConsultaCypher(id);
  if (!consulta) throw new AppError(404, 'CONSULTA_NO_ENCONTRADA', `No existe la consulta "${id}".`);

  const parametros = leerParametros(consulta.parametros, entrada);
  const preparados = prepararParametros(consulta.parametros, consulta.preparar ? consulta.preparar(parametros) : parametros);

  const inicio = Date.now();
  const resultado = await leer(consulta.cypher, preparados);
  const filas = resultado.records.map((r) => aPlano(r.toObject()) as Record<string, unknown>);
  return {
    consulta: describir(consulta),
    parametros,
    filas,
    total_filas: filas.length,
    duracion_ms: Date.now() - inicio,
    cypher: consulta.cypher,
  };
}

// ---------------------------------------------------------------------------------------------
// Catálogos y resumen (para llenar los filtros de la interfaz)
// ---------------------------------------------------------------------------------------------

export async function catalogos() {
  const lista = async (cypher: string) => (await leer(cypher)).records.map((r) => aPlano(r.get(0)));
  const [departamentos, carreras, anios, tipos, materias] = await Promise.all([
    lista('MATCH (d:Departamento) RETURN d.nombre ORDER BY d.nombre'),
    lista('MATCH (c:Carrera) RETURN c.nombre ORDER BY c.nombre'),
    lista('MATCH (p:Postulacion) RETURN DISTINCT p.anio_ingreso AS anio ORDER BY anio'),
    lista('MATCH (t:TipoInstitucion) RETURN t.nombre ORDER BY t.nombre'),
    lista('MATCH (m:Materia) RETURN m.nombre ORDER BY m.nombre'),
  ]);
  return { departamentos, carreras, anios, tipos, materias };
}

export async function resumenGrafo() {
  const nodos = await leer('MATCH (n) RETURN labels(n)[0] AS etiqueta, count(*) AS cantidad ORDER BY cantidad DESC');
  const relaciones = await leer('MATCH ()-[r]->() RETURN type(r) AS tipo, count(*) AS cantidad ORDER BY cantidad DESC');
  return {
    nodos: nodos.records.map((r) => aPlano(r.toObject())),
    relaciones: relaciones.records.map((r) => aPlano(r.toObject())),
  };
}

// ---------------------------------------------------------------------------------------------
// Vista A: mapa de demanda (Departamento – Municipio – Carrera)
// ---------------------------------------------------------------------------------------------

export const PARAMETROS_MAPA: ParametroDef[] = [
  PARAM_ANIO,
  { nombre: 'departamento', tipo: 'texto', requerido: false, patron: '^[a-zñáéíóú ]{3,30}$', descripcion: 'Limita el mapa a un departamento' },
  { nombre: 'solo_aprobados', tipo: 'opcion', requerido: false, por_defecto: 'no', opciones: ['si', 'no'], descripcion: 'Contar solo aspirantes aprobados' },
  { nombre: 'limite', tipo: 'entero', requerido: false, por_defecto: 150, min: 10, max: 600, descripcion: 'Máximo de conexiones municipio–carrera' },
];

export const CYPHER_MAPA = `MATCH (d:Departamento)<-[:PERTENECE_A]-(m:Municipio)<-[:PROCEDE_DE]-(p:Postulacion)-[:ASPIRA_A]->(c:Carrera)
WHERE ($anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso)
  AND ($departamento IS NULL OR d.nombre = $departamento)
  AND (NOT $solo_aprobados OR p.aprobado)
RETURN d.nombre AS departamento, m.id AS municipio_id, m.nombre AS municipio, c.nombre AS carrera, count(p) AS peso
ORDER BY peso DESC
LIMIT $limite`;

/**
 * Devuelve un subgrafo agregado: cada arista municipio → carrera lleva como peso cuántas postulaciones las conectan.
 * Es una vista derivada del grafo (una proyección), pensada para dibujarse sin saturar el navegador.
 */
export async function mapaDemanda(entrada: Record<string, unknown>) {
  const p = leerParametros(PARAMETROS_MAPA, entrada);
  const params = {
    anio_ingreso: entero(p.anio_ingreso as number | undefined),
    departamento: p.departamento ? String(p.departamento).toUpperCase() : null,
    solo_aprobados: p.solo_aprobados === 'si',
    limite: entero(p.limite as number),
  };
  const inicio = Date.now();
  const resultado = await leer(CYPHER_MAPA, params);

  const nodos = new Map<string, NodoGrafo>();
  const aristas = new Map<string, AristaGrafo>();
  const sumar = (id: string, etiqueta: string, tipo: string, peso: number, propiedades: Record<string, unknown> = {}) => {
    const n = nodos.get(id) ?? { id, etiqueta, tipo, peso: 0, propiedades };
    n.peso = (n.peso ?? 0) + peso;
    nodos.set(id, n);
  };
  const arista = (id: string, origen: string, destino: string, tipo: string, peso: number) => {
    const a = aristas.get(id) ?? { id, origen, destino, tipo, peso: 0, propiedades: {} };
    a.peso = (a.peso ?? 0) + peso;
    aristas.set(id, a);
  };

  for (const r of resultado.records) {
    const fila = aPlano(r.toObject()) as { departamento: string; municipio_id: string; municipio: string; carrera: string; peso: number };
    const d = `d:${fila.departamento}`;
    const m = `m:${fila.municipio_id}`;
    const c = `c:${fila.carrera}`;
    sumar(d, fila.departamento, 'Departamento', fila.peso);
    sumar(m, fila.municipio, 'Municipio', fila.peso, { departamento: fila.departamento });
    sumar(c, fila.carrera, 'Carrera', fila.peso);
    arista(`${m}>${d}`, m, d, 'PERTENECE_A', fila.peso);
    arista(`${m}>${c}`, m, c, 'ASPIRA_A', fila.peso);
  }
  const grafo: Grafo = { nodos: [...nodos.values()], aristas: [...aristas.values()] };
  return { parametros: p, grafo, duracion_ms: Date.now() - inicio, cypher: CYPHER_MAPA };
}

// ---------------------------------------------------------------------------------------------
// Vista B: red de un aspirante
// ---------------------------------------------------------------------------------------------

export const CYPHER_ASPIRANTE = `MATCH (a:Aspirante {id: $id})-[po:POSTULO]->(p:Postulacion)
OPTIONAL MATCH (p)-[r:ASPIRA_A|PROCEDE_DE|EN_INSTITUCION|EVALUADA_EN]->(x)
RETURN a, po, p, r, x`;

function etiquetaNodo(n: Node): string {
  const p = n.properties as Record<string, unknown>;
  switch (n.labels[0]) {
    case 'Aspirante':
      return `${String(p.id).slice(0, 8)}…`;
    case 'Postulacion':
      return `Año ${String(p.anio_ingreso)}`;
    default:
      return String(p.nombre ?? p.id);
  }
}

export async function redAspirante(id: string) {
  const limpio = id.trim().toLowerCase();
  if (!/^[0-9a-f]{20,32}$/.test(limpio)) {
    throw new AppError(400, 'PARAMETRO_INVALIDO', 'El identificador debe tener entre 20 y 32 caracteres hexadecimales.');
  }
  const inicio = Date.now();
  const resultado = await leer(CYPHER_ASPIRANTE, { id: limpio.slice(0, 20) });
  if (resultado.records.length === 0) throw new AppError(404, 'SIN_RESULTADOS', 'No existe un aspirante con ese identificador.');

  const nodos = new Map<string, NodoGrafo>();
  const aristas = new Map<string, AristaGrafo>();
  const agregarNodo = (n: Node) => {
    if (!nodos.has(n.elementId)) {
      nodos.set(n.elementId, { id: n.elementId, etiqueta: etiquetaNodo(n), tipo: n.labels[0], propiedades: aPlano(n.properties) as Record<string, unknown> });
    }
  };
  const agregarArista = (r: Relationship) => {
    if (!aristas.has(r.elementId)) {
      aristas.set(r.elementId, {
        id: r.elementId,
        origen: r.startNodeElementId,
        destino: r.endNodeElementId,
        tipo: r.type,
        propiedades: aPlano(r.properties) as Record<string, unknown>,
      });
    }
  };
  for (const rec of resultado.records) {
    agregarNodo(rec.get('a'));
    agregarNodo(rec.get('p'));
    agregarArista(rec.get('po'));
    if (rec.get('x')) {
      agregarNodo(rec.get('x'));
      agregarArista(rec.get('r'));
    }
  }
  const grafo: Grafo = { nodos: [...nodos.values()], aristas: [...aristas.values()] };
  return { aspirante_id: limpio.slice(0, 20), grafo, duracion_ms: Date.now() - inicio, cypher: CYPHER_ASPIRANTE };
}
