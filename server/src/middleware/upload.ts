import fs from 'node:fs';
import multer from 'multer';
import { config } from '../config.js';

// Memoria: sharp decodifica y reescribe la imagen, así que nunca se guarda el archivo original.
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxFileSizeBytes, files: config.uploads.maxFilesPerRequest },
});

// Disco: un respaldo puede pesar más que la memoria disponible.
fs.mkdirSync(config.paths.temp, { recursive: true });
export const backupUpload = multer({
  dest: config.paths.temp,
  limits: { fileSize: config.backups.maxUploadBytes, files: 1 },
});
