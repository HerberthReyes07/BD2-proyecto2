/**
 * Error controlado de la aplicación. El middleware de errores lo convierte en una respuesta JSON clara
 * (con el código HTTP indicado) sin que el servidor se caiga.
 */
export class AppError extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = 'AppError';
  }
}
