// Tipos compartidos del ETL y del modelo de datos (ver docs/reglas-etl.md y docs/modelo-mongodb.md)
import type { ObjectId } from 'mongodb';

/** Las 12 columnas del CSV, con su nombre canónico (los archivos 2022-2024 traen algunos encabezados cortados). */
export const CAMPOS = [
  'fecha_asignacion',
  'sexo',
  'anio_nacimiento',
  'materia',
  'numero_de_fecha_de_evaluacion',
  'anio_de_ingreso',
  'aprobacion',
  'carrera_objetivo',
  'departamento_institucion_educativa',
  'municipio_institucion_educativa',
  'tipo_institucion_educativa',
  'correlativo_aspirante',
] as const;
export type Campo = (typeof CAMPOS)[number];
export type ValoresCrudos = Record<Campo, string>;

export const MATERIAS = ['MATEMATICA', 'COMPUTACION', 'MATEMATICA ITUGS'] as const;
export type Materia = (typeof MATERIAS)[number];

export const TIPOS_INSTITUCION = ['PRIVADO', 'PUBLICO', 'POR COOPERATIVA', 'MUNICIPAL'] as const;

/** Causas por las que una fila se rechaza (no se carga). */
export type CausaRechazo =
  | 'ESTRUCTURA_INVALIDA'
  | 'CAMPO_REQUERIDO_VACIO'
  | 'FECHA_INVALIDA'
  | 'SEXO_INVALIDO'
  | 'ANIO_NACIMIENTO_INVALIDO'
  | 'MATERIA_INVALIDA'
  | 'OPORTUNIDAD_INVALIDA'
  | 'ANIO_INGRESO_INVALIDO'
  | 'APROBACION_INVALIDA'
  | 'TIPO_INSTITUCION_INVALIDO'
  | 'CORRELATIVO_INVALIDO'
  | 'DUPLICADO';

/** Advertencias: la fila se carga, pero queda marcada. */
export type Advertencia =
  | 'SEXO_SIN_REGISTRO'
  | 'SIN_ANIO_NACIMIENTO'
  | 'EDAD_FUERA_DE_RANGO'
  | 'SIN_CARRERA'
  | 'CARRERA_COMPLETADA'
  | 'CARRERA_AMBIGUA'
  | 'INSTITUCION_SIN_DATOS'
  | 'ZONA_NO_DISPONIBLE'
  | 'MUNICIPIO_RECUPERADO'
  | 'MUNICIPIO_TRUNCADO'
  | 'DEPARTAMENTO_CORREGIDO'
  | 'ANIO_INGRESO_DISTINTO_DE_ARCHIVO'
  | 'CONFLICTO_SEXO'
  | 'REPROBACION_POSTERIOR_A_APROBACION'
  | 'MULTIPLE_APROBACION';

export interface Rechazo {
  linea: number;
  causa: CausaRechazo;
  detalle: string;
  valores_originales: Record<string, string>;
}

/** Fila que pasó la validación: valores ya convertidos de tipo, pero aún sin normalizar (carrera y ubicación van crudas). */
export interface FilaValidada {
  fecha: Date;
  sexo: 'M' | 'F' | null;
  anioNacimiento: number | null;
  materia: Materia;
  oportunidad: number;
  anioIngreso: number;
  aprobada: boolean;
  carreraCruda: string;
  departamentoCrudo: string;
  municipioCrudo: string;
  tipoCrudo: string;
  correlativo: string;
}

// ---------------------------------------------------------------------------------------------
// Documentos de MongoDB
// ---------------------------------------------------------------------------------------------

export interface EvaluacionDoc {
  _id: string; // anio_ingreso|aspirante_id|oportunidad|materia
  aspirante_id: string;
  correlativo_original: string;
  anio_ingreso: number;
  oportunidad: number;
  materia: Materia;
  fecha_asignacion: Date;
  anio_mes: string;
  mes: number;
  aprobada: boolean;
  carrera: string | null;
  sexo: 'M' | 'F' | null;
  anio_nacimiento: number | null;
  edad: number | null;
  departamento: string | null;
  municipio: string | null;
  zona: number | null;
  tipo_institucion: string | null;
  advertencias: Advertencia[];
  origen: { archivo: string; linea: number };
}

export interface MateriaResumen {
  materia: Materia;
  aprobada: boolean;
  intentos: number;
  intento_aprobacion: number | null;
  fecha_primera_aprobacion: Date | null;
  oportunidades: number[];
}

export type EstadoPostulacion = 'APROBADO' | 'YA_HABILITADO' | 'PARCIAL' | 'NO_APROBADO';

export interface PostulacionDoc {
  _id: string; // anio_ingreso|aspirante_id
  aspirante_id: string;
  anio_ingreso: number;
  sexo: 'M' | 'F' | null;
  anio_nacimiento: number | null;
  edad: number | null;
  departamento: string | null;
  municipio: string | null;
  zona: number | null;
  tipo_institucion: string | null;
  carreras: string[];
  materias: MateriaResumen[];
  primer_intento: {
    oportunidad: number;
    fecha: Date;
    reprobo: boolean;
    carreras: string[];
    resultados: { materia: Materia; aprobada: boolean }[];
  };
  n_evaluaciones: number;
  estado: EstadoPostulacion;
  aprobado: boolean;
  anio_habilitacion: number | null;
  fecha_habilitacion: Date | null;
  aprobo_ambas_en_el_anio: boolean;
  advertencias: Advertencia[];
}

export interface AspiranteDoc {
  _id: string;
  correlativo_original: string;
  sexo: 'M' | 'F' | null;
  anio_nacimiento: number | null;
  tipo_institucion: string | null;
  departamento: string | null;
  municipio: string | null;
  anios_ingreso: number[];
  habilitacion: { anio: number; fecha: Date } | null;
  historial: {
    anio_ingreso: number;
    oportunidad: number;
    fecha: Date;
    materia: Materia;
    aprobada: boolean;
    carrera: string | null;
  }[];
  advertencias: Advertencia[];
}

// ---------------------------------------------------------------------------------------------
// Reporte de carga
// ---------------------------------------------------------------------------------------------

export type EstadoCarga = 'EN_PROCESO' | 'COMPLETADA' | 'COMPLETADA_CON_ERRORES' | 'FALLIDA';

export interface ResumenNeo4j {
  estado: 'COMPLETADA' | 'FALLIDA' | 'OMITIDA';
  nodos_creados: number;
  relaciones_creadas: number;
  duracion_ms: number;
  error?: string;
}

export interface ReporteCarga {
  _id?: ObjectId;
  archivo: string;
  iniciada_en: Date;
  finalizada_en: Date | null;
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
