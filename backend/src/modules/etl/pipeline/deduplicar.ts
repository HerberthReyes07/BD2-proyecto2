import { EvaluacionDoc, Rechazo, ValoresCrudos } from '../etl.types';

export interface Entrada {
  doc: EvaluacionDoc;
  valores: ValoresCrudos;
}

const CAMPOS_COMPARABLES: (keyof EvaluacionDoc)[] = [
  'fecha_asignacion',
  'sexo',
  'anio_nacimiento',
  'aprobada',
  'carrera',
  'departamento',
  'municipio',
  'tipo_institucion',
];

function valorComparable(v: unknown): unknown {
  return v instanceof Date ? v.getTime() : v;
}

function camposDistintos(a: EvaluacionDoc, b: EvaluacionDoc): string[] {
  return CAMPOS_COMPARABLES.filter((c) => valorComparable(a[c]) !== valorComparable(b[c])) as string[];
}

/**
 * R-D1: dentro de un archivo, dos filas con la misma clave (año de ingreso + aspirante + oportunidad + materia)
 * son duplicados. Se conserva la de fecha de asignación más temprana (en empate, la primera del archivo) y la
 * otra se devuelve como rechazo DUPLICADO, con la línea de la fila conservada y los campos en que difieren.
 *
 * Agrega `nueva` al mapa y devuelve el rechazo si hubo duplicado (o null si no).
 */
export function agregarSinDuplicar(mapa: Map<string, Entrada>, nueva: Entrada): Rechazo | null {
  const existente = mapa.get(nueva.doc._id);
  if (!existente) {
    mapa.set(nueva.doc._id, nueva);
    return null;
  }
  const gana = nueva.doc.fecha_asignacion.getTime() < existente.doc.fecha_asignacion.getTime() ? nueva : existente;
  const pierde = gana === nueva ? existente : nueva;
  mapa.set(nueva.doc._id, gana);

  const distintos = camposDistintos(gana.doc, pierde.doc);
  return {
    linea: pierde.doc.origen.linea,
    causa: 'DUPLICADO',
    detalle:
      `Misma clave que la línea ${gana.doc.origen.linea}; ` +
      (distintos.length ? `difiere en: ${distintos.join(', ')}` : 'idéntica en los demás campos'),
    valores_originales: pierde.valores,
  };
}
