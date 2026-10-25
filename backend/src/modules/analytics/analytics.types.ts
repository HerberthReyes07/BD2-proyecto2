import { Db, Document } from 'mongodb';

/** Cómo debe dibujar el frontend el resultado de una consulta. */
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
  patron?: string; // expresión regular que debe cumplir un parámetro de texto
}

export type Parametros = Record<string, string | number | undefined>;

/**
 * Una consulta analítica de MongoDB. Cada una vive en su propio archivo (queries/qNN-*.ts) y reúne todo lo
 * necesario: qué responde, sobre qué colección, el pipeline de agregación y cómo se grafica.
 */
export interface ConsultaMongo {
  id: string; // "q01"
  numero: number;
  titulo: string;
  descripcion: string; // qué pregunta responde
  explicacion: string; // cómo funciona el pipeline (se usa en la documentación)
  coleccion: 'evaluaciones' | 'postulaciones' | 'aspirantes';
  grafica: TipoGrafica;
  /** Qué campos del resultado van en cada eje: x, y (una o varias series), serie (agrupa por color) y línea (eje secundario). */
  ejes?: { x?: string; y?: string[]; serie?: string; linea?: string };
  parametros: ParametroDef[]; // parámetros propios de la consulta
  filtroAnio: boolean; // admite el filtro opcional ?anio_ingreso=AAAA
  /** Si se define, responde 404 con este mensaje cuando la consulta no devuelve filas. */
  vacioEs404?: string;
  construirPipeline: (p: Parametros) => Document[];
  /** Para consultas que no son un simple aggregate (por ejemplo la 6, que además crea una colección). */
  ejecutar?: (db: Db, p: Parametros) => Promise<Document[]>;
}
