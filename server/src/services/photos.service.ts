import { getDb } from '../db/connection.js';
import { notFound } from '../errors.js';
import { establishmentModel } from '../models/establishment.model.js';
import { photoModel, type PhotoCategory } from '../models/photo.model.js';
import { toPhotoDto } from './establishments.service.js';
import { removeImage, storeImage, type StoredImage } from './images.service.js';

export async function addPhotos(
  establishmentId: number,
  files: { buffer: Buffer; originalname: string }[],
  mainIndex: number | null,
  category: PhotoCategory = 'lugar',
) {
  if (!establishmentModel.findById(establishmentId)) throw notFound('Lugar');

  // Todas las imágenes deben procesarse bien antes de tocar la base de datos.
  const stored: StoredImage[] = [];
  try {
    for (const file of files) stored.push(await storeImage(file, 'establishments'));
  } catch (error) {
    for (const image of stored) removeImage('establishments', image.filename, image.thumbFilename);
    throw error;
  }

  const hadMain = photoModel.findByEstablishment(establishmentId).some((photo) => photo.is_main === 1);
  const db = getDb();
  db.transaction(() => {
    const ids = stored.map((image) => photoModel.insert(establishmentId, image, category));
    const chosen = mainIndex !== null ? ids[mainIndex] : undefined;
    const main = chosen ?? (hadMain ? undefined : ids[0]);
    if (main !== undefined) photoModel.setMain(establishmentId, main);
  })();
  return photoModel.findByEstablishment(establishmentId).map(toPhotoDto);
}

export function setMainPhoto(photoId: number) {
  const photo = photoModel.findById(photoId);
  if (!photo) throw notFound('Fotografía');
  photoModel.setMain(photo.establishment_id, photoId);
  return photoModel.findByEstablishment(photo.establishment_id).map(toPhotoDto);
}

export function setPhotoCategory(photoId: number, category: PhotoCategory) {
  const photo = photoModel.findById(photoId);
  if (!photo) throw notFound('Fotografía');
  photoModel.setCategory(photoId, category);
  return photoModel.findByEstablishment(photo.establishment_id).map(toPhotoDto);
}

export function deletePhoto(photoId: number) {
  const photo = photoModel.findById(photoId);
  if (!photo) throw notFound('Fotografía');
  const db = getDb();
  db.transaction(() => {
    photoModel.delete(photoId);
    // Al borrar la principal, la siguiente toma su lugar.
    if (photo.is_main === 1) {
      const next = photoModel.findByEstablishment(photo.establishment_id)[0];
      if (next) photoModel.setMain(photo.establishment_id, next.id);
    }
  })();
  removeImage('establishments', photo.filename, photo.thumb_filename);
  return photoModel.findByEstablishment(photo.establishment_id).map(toPhotoDto);
}
