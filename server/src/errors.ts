/** Error de aplicación con estado HTTP y, opcionalmente, errores por campo de formulario. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what}: no se encontró.`);
