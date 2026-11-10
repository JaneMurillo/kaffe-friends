import { getDb } from '../db/connection.js';
import { notFound } from '../errors.js';
import { establishmentModel } from '../models/establishment.model.js';
import {
  availabilityModel,
  seasonalModel,
  type AvailabilityRow,
  type AvailabilityWrite,
  type SeasonalRow,
} from '../models/extras.model.js';
import { mediaUrl, removeImage, storeImage } from './images.service.js';

type UploadedFile = { buffer: Buffer; originalname: string };

export interface SeasonalInput {
  name: string;
  triedOn: string;
  note: string;
  status: 'disponible' | 'temporal';
  removePhoto: boolean;
}

export const toAvailabilityDto = (row: AvailabilityRow) => ({
  id: row.id,
  productName: row.product_name,
  note: row.note,
  availableWhen: row.available_when,
  sellsOutFast: row.sells_out_fast === 1,
});

export const toSeasonalDto = (row: SeasonalRow) => ({
  id: row.id,
  name: row.name,
  triedOn: row.tried_on,
  note: row.note,
  status: row.status,
  photoUrl: row.photo_filename ? mediaUrl('seasonal', row.photo_filename) : null,
  photoThumbUrl: row.photo_thumb_filename ? mediaUrl('seasonal', row.photo_thumb_filename) : null,
});

const requirePlace = (id: number) => {
  if (!establishmentModel.findById(id)) throw notFound('Lugar');
};

export function createAvailability(establishmentId: number, input: AvailabilityWrite) {
  requirePlace(establishmentId);
  return toAvailabilityDto(availabilityModel.findById(availabilityModel.insert(establishmentId, input))!);
}

export function updateAvailability(id: number, input: AvailabilityWrite) {
  if (!availabilityModel.findById(id)) throw notFound('Producto');
  availabilityModel.update(id, input);
  return toAvailabilityDto(availabilityModel.findById(id)!);
}

export function deleteAvailability(id: number): void {
  if (!availabilityModel.findById(id)) throw notFound('Producto');
  availabilityModel.delete(id);
}

export async function createSeasonal(establishmentId: number, input: SeasonalInput, file?: UploadedFile) {
  requirePlace(establishmentId);
  const image = file ? await storeImage(file, 'seasonal') : null;
  const id = seasonalModel.insert(establishmentId, {
    name: input.name,
    triedOn: input.triedOn,
    note: input.note,
    status: input.status,
    photoFilename: image?.filename ?? null,
    photoThumbFilename: image?.thumbFilename ?? null,
  });
  return toSeasonalDto(seasonalModel.findById(id)!);
}

export async function updateSeasonal(id: number, input: SeasonalInput, file?: UploadedFile) {
  const existing = seasonalModel.findById(id);
  if (!existing) throw notFound('Producto de temporada');
  const image = file ? await storeImage(file, 'seasonal') : null;
  const dropOld = Boolean(image) || input.removePhoto;
  getDb().transaction(() => {
    seasonalModel.update(id, {
      name: input.name,
      triedOn: input.triedOn,
      note: input.note,
      status: input.status,
      photoFilename: image?.filename ?? (dropOld ? null : existing.photo_filename),
      photoThumbFilename: image?.thumbFilename ?? (dropOld ? null : existing.photo_thumb_filename),
    });
  })();
  if (dropOld) removeImage('seasonal', existing.photo_filename, existing.photo_thumb_filename);
  return toSeasonalDto(seasonalModel.findById(id)!);
}

export function deleteSeasonal(id: number): void {
  const existing = seasonalModel.findById(id);
  if (!existing) throw notFound('Producto de temporada');
  seasonalModel.delete(id);
  removeImage('seasonal', existing.photo_filename, existing.photo_thumb_filename);
}
