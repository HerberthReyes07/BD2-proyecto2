const numeros = new Intl.NumberFormat('es-GT');
const decimales = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 });

export const num = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : numeros.format(n));

// Los nombres de campo de la API no llevan tildes ni eñes (anios, aprobacion...); aquí se restauran para mostrarlos
const PALABRAS: Record<string, string> = {
  anio: 'año',
  anios: 'años',
  aprobacion: 'aprobación',
  participacion: 'participación',
  institucion: 'institución',
  posicion: 'posición',
  habilitacion: 'habilitación',
  minimo: 'mínimo',
  maximo: 'máximo',
  limite: 'límite',
  numero: 'número',
};

/** "anios_de_participacion" → "Años de participación" */
export function etiqueta(nombre: string): string {
  const texto = nombre
    .split('_')
    .map((palabra) => PALABRAS[palabra] ?? palabra)
    .join(' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function duracion(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

export function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'medium' });
}

/** Texto legible para una celda de tabla: booleanos, números, fechas y arreglos de evaluaciones. */
export function celda(valor: unknown, columna = ''): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  // Años, edades y números de oportunidad o intento no llevan separador de miles
  if (typeof valor === 'number' && /anio|edad|oportunidad|posicion|intento|zona/.test(columna)) return String(valor);
  if (typeof valor === 'number') return Number.isInteger(valor) ? numeros.format(valor) : decimales.format(valor);
  if (typeof valor === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(valor) ? valor.slice(0, 10) : valor;
  if (Array.isArray(valor)) {
    if (valor.length > 0 && valor.every((v) => v && typeof v === 'object' && 'oportunidad' in v && 'aprobada' in v)) {
      return (valor as { oportunidad: number; aprobada: boolean }[]).map((v) => `Op.${v.oportunidad} ${v.aprobada ? '✓' : '✗'}`).join('  ');
    }
    return valor.map((v) => celda(v)).join(', ');
  }
  const json = JSON.stringify(valor);
  return json.length > 80 ? `${json.slice(0, 77)}…` : json;
}

export const esPorcentaje = (nombre: string): boolean => /porcentaje|tasa/.test(nombre);
