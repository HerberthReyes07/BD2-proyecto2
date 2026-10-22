/** Mayúsculas, espacios internos colapsados y sin espacios en los extremos. */
export function normalizarTexto(s: string): string {
  return s.normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim();
}
