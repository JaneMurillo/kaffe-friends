import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

export type MediaFolder = 'establishments' | 'reviews' | 'seasonal';

export interface StoredImage {
  filename: string;
  thumbFilename: string;
  width: number;
  height: number;
}

const folderPath = (folder: MediaFolder) => path.join(config.paths.uploads, folder);

/**
 * Convierte la subida en dos WebP (galería y miniatura). Reescribir la imagen valida
 * que realmente lo sea y elimina sus metadatos, incluido el GPS de las fotos de celular.
 */
export async function storeImage(
  file: { buffer: Buffer; originalname: string },
  folder: MediaFolder,
): Promise<StoredImage> {
  const directory = folderPath(folder);
  fs.mkdirSync(directory, { recursive: true });
  const id = randomUUID();
  const filename = `${id}.webp`;
  const thumbFilename = `${id}.thumb.webp`;
  try {
    const { maxPhotoWidth, thumbWidth } = config.uploads;
    const info = await sharp(file.buffer)
      .rotate()
      .resize({ width: maxPhotoWidth, height: maxPhotoWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(path.join(directory, filename));
    await sharp(file.buffer)
      .rotate()
      .resize({ width: thumbWidth, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(path.join(directory, thumbFilename));
    return { filename, thumbFilename, width: info.width, height: info.height };
  } catch {
    removeImage(folder, filename, thumbFilename);
    throw new HttpError(
      400,
      `"${file.originalname}" no se pudo leer como imagen. Usa JPG, PNG o WebP (las fotos HEIC de iPhone hay que convertirlas antes).`,
    );
  }
}

export function removeImage(folder: MediaFolder, ...filenames: (string | null | undefined)[]): void {
  for (const filename of filenames) {
    if (!filename) continue;
    // La fila de la base de datos ya no existe: un archivo huérfano no debe romper la operación.
    fs.rmSync(path.join(folderPath(folder), path.basename(filename)), { force: true });
  }
}

export const mediaUrl = (folder: MediaFolder, filename: string) => `/media/${folder}/${filename}`;
