import { AppError } from '../../shared/errors/AppError';

let operacionActual: string | null = null;

/**
 * Evita que dos operaciones pesadas sobre las bases de datos se mezclen (por ejemplo, borrar los datos mientras
 * se está cargando un archivo). Si ya hay una en curso, la nueva se rechaza con un 409 y un mensaje claro.
 */
export async function conBloqueo<T>(nombre: string, fn: () => Promise<T>): Promise<T> {
  if (operacionActual) {
    throw new AppError(409, 'OPERACION_EN_CURSO', `Hay una operación en curso (${operacionActual}). Espera a que termine e inténtalo de nuevo.`);
  }
  operacionActual = nombre;
  try {
    return await fn();
  } finally {
    operacionActual = null;
  }
}
