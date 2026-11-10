import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../errors.js';

export function apiNotFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { message: 'Ruta no encontrada.' } });
}

// Express identifica los manejadores de errores por sus cuatro parámetros.
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { message: error.message, fields: error.fields } });
    return;
  }
  if (error instanceof multer.MulterError) {
    const messages: Partial<Record<multer.ErrorCode, string>> = {
      LIMIT_FILE_SIZE: 'El archivo es demasiado grande (máximo 15 MB por fotografía).',
      LIMIT_FILE_COUNT: 'Son demasiados archivos a la vez (máximo 20).',
      LIMIT_UNEXPECTED_FILE: 'Se recibió un archivo inesperado.',
    };
    res.status(400).json({ error: { message: messages[error.code] ?? 'No se pudo recibir el archivo.' } });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { message: 'La solicitud no es válida.' } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { message: 'Ocurrió un error inesperado en el servidor.' } });
}
