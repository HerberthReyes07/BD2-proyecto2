/** Mayúsculas, espacios internos colapsados y sin espacios en los extremos. */
export function normalizarTexto(s: string): string {
  return s.normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * R-G8: nombres de departamento que el dataset escribe distinto de su nombre oficial. Se revisaron los 22
 * departamentos: solo Quetzaltenango viene mal escrito (sin la T), aunque sus municipios sí la llevan.
 */
const DEPARTAMENTOS_CORREGIDOS: Record<string, string> = {
  QUEZALTENANGO: 'QUETZALTENANGO',
};

export function corregirDepartamento(departamentoNormalizado: string): { departamento: string; corregido: boolean } {
  const oficial = DEPARTAMENTOS_CORREGIDOS[departamentoNormalizado];
  return oficial ? { departamento: oficial, corregido: true } : { departamento: departamentoNormalizado, corregido: false };
}
