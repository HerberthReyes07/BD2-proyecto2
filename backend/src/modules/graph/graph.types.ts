import { ParametroDef, Parametros, TipoGrafica } from '../analytics/analytics.types';

/**
 * Una consulta de grafos sobre Neo4j. Igual que las de MongoDB, cada una vive en su propio archivo
 * (cypher/gNN-*.ts) y reúne el texto Cypher, sus parámetros y cómo se grafica el resultado.
 */
export interface ConsultaCypher {
  id: string; // "g01"
  numero: number;
  titulo: string;
  descripcion: string;
  explicacion: string; // qué patrón se busca y qué demuestra del modelo de grafos
  demuestra: string[]; // nodos, relaciones, propiedades, filtros, recorridos
  cypher: string;
  parametros: ParametroDef[];
  grafica: TipoGrafica;
  ejes?: { x?: string; y?: string[]; serie?: string };
  /** Ajusta los parámetros antes de enviarlos (por ejemplo, pasar un texto a mayúsculas). */
  preparar?: (p: Parametros) => Parametros;
}

export interface NodoGrafo {
  id: string;
  etiqueta: string; // texto que se dibuja
  tipo: string; // etiqueta de Neo4j: Departamento, Municipio, Carrera, Aspirante...
  peso?: number; // tamaño relativo
  propiedades: Record<string, unknown>;
}

export interface AristaGrafo {
  id: string;
  origen: string;
  destino: string;
  tipo: string; // tipo de relación: ASPIRA_A, PERTENECE_A...
  peso?: number;
  propiedades: Record<string, unknown>;
}

export interface Grafo {
  nodos: NodoGrafo[];
  aristas: AristaGrafo[];
}
