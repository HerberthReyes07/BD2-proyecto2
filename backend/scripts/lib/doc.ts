/** Utilidades compartidas por los generadores de documentación (consultas de MongoDB y de Neo4j). */

export type Fila = Record<string, unknown>;

export const MAX_FILAS = 8;
const MAX_COLUMNAS = 7;

const escapar = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    const texto = JSON.stringify(valor);
    return escapar(texto.length > 60 ? texto.slice(0, 57) + '…' : texto);
  }
  return escapar(String(valor));
}

/** Tabla markdown con las primeras filas del resultado. Las columnas con arreglos u objetos se omiten si sobran. */
export function tabla(filas: Fila[]): string {
  if (filas.length === 0) return '_Sin filas._';
  let columnas = Object.keys(filas[0]);
  if (columnas.length > MAX_COLUMNAS) {
    const simples = columnas.filter((c) => typeof filas[0][c] !== 'object' || filas[0][c] === null);
    columnas = simples.slice(0, MAX_COLUMNAS);
  }
  const lineas = [`| ${columnas.join(' | ')} |`, `|${columnas.map(() => '---').join('|')}|`];
  for (const fila of filas.slice(0, MAX_FILAS)) lineas.push(`| ${columnas.map((c) => celda(fila[c])).join(' | ')} |`);
  return lineas.join('\n');
}

/** Formatea JSON dejando en una sola línea todo lo que quepa (≤ 100 caracteres) y desplegando solo lo largo. */
export function formatear(valor: unknown, sangria = ''): string {
  const compacto = JSON.stringify(valor);
  if (compacto.length + sangria.length <= 100) return compacto;
  const interna = sangria + '  ';
  if (Array.isArray(valor)) {
    return `[\n${valor.map((v) => interna + formatear(v, interna)).join(',\n')}\n${sangria}]`;
  }
  if (valor && typeof valor === 'object') {
    const campos = Object.entries(valor).map(([k, v]) => `${interna}${JSON.stringify(k)}: ${formatear(v, interna)}`);
    return `{\n${campos.join(',\n')}\n${sangria}}`;
  }
  return compacto;
}
