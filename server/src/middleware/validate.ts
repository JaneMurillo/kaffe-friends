import type { ZodError, ZodTypeAny, z } from 'zod';
import { HttpError } from '../errors.js';
import { idParam } from '../validation/schemas.js';

function toHttpError(error: ZodError): HttpError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!fields[key]) fields[key] = issue.message;
  }
  return new HttpError(400, 'Revisa los datos marcados.', fields);
}

export function parse<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw toHttpError(result.error);
  return result.data;
}

export function parseId(value: unknown): number {
  const result = idParam.safeParse(value);
  if (!result.success) throw new HttpError(404, 'Recurso no encontrado.');
  return result.data;
}
