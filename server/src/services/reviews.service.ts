import { getDb } from '../db/connection.js';
import { notFound } from '../errors.js';
import { establishmentModel } from '../models/establishment.model.js';
import { friendModel, reviewModel } from '../models/review.model.js';
import { collapseSpaces } from '../utils.js';
import type { Answers } from '../validation/schemas.js';
import { loadAll, toReviewDto } from './establishments.service.js';
import { removeImage, storeImage, type StoredImage } from './images.service.js';
import { average } from './scores.service.js';

export interface ReviewInput {
  friendName: string;
  score: number | null;
  comment: string;
  ordered: string;
  answers: Answers;
  visitDate: string | null;
  removePhoto: boolean;
}

type UploadedFile = { buffer: Buffer; originalname: string };

export async function createReview(establishmentId: number, input: ReviewInput, file?: UploadedFile) {
  if (!establishmentModel.findById(establishmentId)) throw notFound('Lugar');
  const image: StoredImage | null = file ? await storeImage(file, 'reviews') : null;
  const db = getDb();
  const id = db.transaction(() =>
    reviewModel.insert(establishmentId, {
      friendId: friendModel.findOrCreate(collapseSpaces(input.friendName)),
      score: input.score,
      comment: input.comment,
      ordered: input.ordered,
      answers: JSON.stringify(input.answers),
      visitDate: input.visitDate,
      photoFilename: image?.filename ?? null,
      photoThumbFilename: image?.thumbFilename ?? null,
    }),
  )();
  return toReviewDto(reviewModel.findById(id)!);
}

export async function updateReview(id: number, input: ReviewInput, file?: UploadedFile) {
  const existing = reviewModel.findById(id);
  if (!existing) throw notFound('Opinión');
  const image: StoredImage | null = file ? await storeImage(file, 'reviews') : null;
  const dropOldPhoto = Boolean(image) || input.removePhoto;
  const db = getDb();
  db.transaction(() => {
    reviewModel.update(id, {
      friendId: friendModel.findOrCreate(collapseSpaces(input.friendName)),
      score: input.score,
      comment: input.comment,
      ordered: input.ordered,
      answers: JSON.stringify(input.answers),
      visitDate: input.visitDate,
      photoFilename: image?.filename ?? (dropOldPhoto ? null : existing.photo_filename),
      photoThumbFilename: image?.thumbFilename ?? (dropOldPhoto ? null : existing.photo_thumb_filename),
    });
    friendModel.deleteOrphans();
  })();
  if (dropOldPhoto) removeImage('reviews', existing.photo_filename, existing.photo_thumb_filename);
  return toReviewDto(reviewModel.findById(id)!);
}

export function deleteReview(id: number): void {
  const existing = reviewModel.findById(id);
  if (!existing) throw notFound('Opinión');
  const db = getDb();
  db.transaction(() => {
    reviewModel.delete(id);
    friendModel.deleteOrphans();
  })();
  removeImage('reviews', existing.photo_filename, existing.photo_thumb_filename);
}

export function listFriends() {
  return friendModel.findAll().map((friend) => ({
    id: friend.id,
    name: friend.name,
    reviewCount: friend.review_count,
    averageScore: friend.average_score === null ? null : Math.round(friend.average_score * 100) / 100,
  }));
}

/** Historial de un amigo: todas sus opiniones con el lugar al que pertenecen. */
export function getFriend(id: number) {
  const friend = friendModel.findById(id);
  if (!friend) throw notFound('Amigo');
  const places = new Map(loadAll().map((place) => [place.id, place]));
  const reviews = reviewModel.findByFriend(id).map((review) => {
    const place = places.get(review.establishment_id);
    return {
      ...toReviewDto(review),
      establishment: {
        id: review.establishment_id,
        name: place?.name ?? '',
        type: place?.type ?? 'cafeteria',
        neighborhood: place?.neighborhood ?? '',
        address: place?.address ?? '',
        mainPhoto: place?.mainPhoto ?? null,
      },
    };
  });
  const scored = reviews.flatMap((review) => (review.score === null ? [] : [review.score]));
  return { id: friend.id, name: friend.name, averageScore: average(scored), reviews };
}
