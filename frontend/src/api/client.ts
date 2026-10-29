/** Error de la API con el código y el mensaje que envía el backend (o SIN_CONEXION si no hay respuesta). */
export class ApiError extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = 'ApiError';
  }
}

/** Arma ?a=1&b=2 omitiendo los valores vacíos. */
export function queryString(params: Record<string, unknown> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.set(k, String(v));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

/** Hace una petición a /api y convierte las respuestas de error en ApiError con un mensaje legible. */
export async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, opciones);
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
  }
  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // respuesta sin JSON: se maneja abajo
  }
  if (!respuesta.ok) {
    const e = (cuerpo as { error?: { codigo?: string; mensaje?: string; detalle?: unknown } } | null)?.error;
    throw new ApiError(
      respuesta.status,
      e?.codigo ?? 'ERROR',
      e?.mensaje ?? `El servidor respondió con el error ${respuesta.status}.`,
      e?.detalle,
    );
  }
  return cuerpo as T;
}
