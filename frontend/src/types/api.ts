// Tipos de las respuestas de la API (ver backend/src/modules/*)

export type Fila = Record<string, unknown>;

export type TipoGrafica = 'barras' | 'barras_agrupadas' | 'barras_apiladas' | 'pastel' | 'lineas' | 'tabla' | 'detalle';

export interface ParametroDef {
  nombre: string;
  tipo: 'entero' | 'texto' | 'opcion';
  requerido: boolean;
  por_defecto?: string | number;
  descripcion: string;
  min?: number;
  max?: number;
  opciones?: string[];
}

export interface ConsultaMeta {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string;
  explicacion: string;
  coleccion?: string;
  demuestra?: string[];
  grafica: TipoGrafica;
  ejes: { x?: string; y?: string[]; serie?: string; linea?: string } | null;
  parametros: ParametroDef[];
}

export interface ResultadoConsulta {
  consulta: ConsultaMeta;
  parametros: Record<string, unknown>;
  filas: Fila[];
  total_filas: number;
  duracion_ms: number;
  pipeline?: unknown[]; // consultas de MongoDB
  cypher?: string; // consultas de Neo4j
}

// ---- Carga de archivos ----
export type EstadoCarga = 'EN_PROCESO' | 'COMPLETADA' | 'COMPLETADA_CON_ERRORES' | 'FALLIDA';

export interface ResumenNeo4j {
  estado: 'COMPLETADA' | 'FALLIDA' | 'OMITIDA';
  nodos_creados: number;
  relaciones_creadas: number;
  duracion_ms: number;
  error?: string;
}

export interface ReporteCarga {
  _id: string;
  archivo: string;
  iniciada_en: string;
  finalizada_en: string | null;
  duracion_ms: number;
  estado: EstadoCarga;
  leidos: number;
  cargados: number;
  rechazados: number;
  omitidos: number;
  rechazos_por_causa: Record<string, number>;
  advertencias_por_tipo: Record<string, number>;
  neo4j: ResumenNeo4j | null;
  error: string | null;
}

export interface ResultadoCargas {
  archivos: ReporteCarga[];
  derivadas: { aspirantes: number; postulaciones: number; por_estado: Record<string, number>; duracion_ms: number } | null;
  neo4j: ResumenNeo4j;
}

export interface Rechazado {
  _id: string;
  archivo: string;
  linea: number;
  causa: string;
  detalle: string;
  valores_originales: Record<string, string>;
}

// ---- Resumen y grafos ----
export interface ResumenGeneral {
  evaluaciones: number;
  postulaciones: number;
  aspirantes: number;
  aprobados: number;
  aprobados_en_el_anio: number;
  rechazados: number;
  anio_inicial: number | null;
  anio_final: number | null;
}

export interface NodoGrafo {
  id: string;
  etiqueta: string;
  tipo: string;
  peso?: number;
  propiedades: Record<string, unknown>;
}

export interface AristaGrafo {
  id: string;
  origen: string;
  destino: string;
  tipo: string;
  peso?: number;
  propiedades: Record<string, unknown>;
}

export interface Grafo {
  nodos: NodoGrafo[];
  aristas: AristaGrafo[];
}

export interface CatalogosGrafo {
  departamentos: string[];
  carreras: string[];
  anios: number[];
  tipos: string[];
  materias: string[];
}

// ---- Buscador ----
export interface PostulacionResumen {
  _id: string;
  aspirante_id: string;
  anio_ingreso: number;
  edad: number | null;
  sexo: 'M' | 'F' | null;
  carreras: string[];
  departamento: string | null;
  municipio: string | null;
  zona: number | null;
  tipo_institucion: string | null;
  estado: 'APROBADO' | 'YA_HABILITADO' | 'PARCIAL' | 'NO_APROBADO';
  n_evaluaciones: number;
}

export interface ResultadoBusqueda {
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
  duracion_ms: number;
  filas: PostulacionResumen[];
}

export interface CatalogosBusqueda {
  carreras: string[];
  tipos: string[];
  departamentos: string[];
  anios: number[];
  materias: string[];
  estados: string[];
  municipios: { departamento: string; municipio: string }[];
}

export interface ResultadoReinicio {
  mongo: { colecciones_borradas: string[]; documentos_borrados: number };
  neo4j: { nodos_borrados: number };
  duracion_ms: number;
}
