import { getDb } from '../db/connection.js';
import { HttpError, notFound } from '../errors.js';
import {
  establishmentModel,
  ratingModel,
  type EstablishmentRow,
  type RatingRow,
  type RatingWrite,
} from '../models/establishment.model.js';
import { availabilityModel, seasonalModel } from '../models/extras.model.js';
import { photoModel, type PhotoCategory, type PhotoRow } from '../models/photo.model.js';
import { friendModel, reviewModel, type ReviewRow } from '../models/review.model.js';
import { normalizeText } from '../utils.js';
import {
  answersSchema,
  hasAnswers,
  type Answers,
  type EstablishmentInput,
  type EstablishmentQuery,
  type NotesInput,
} from '../validation/schemas.js';
import { toAvailabilityDto, toSeasonalDto } from './extras.service.js';
import { mediaUrl, removeImage } from './images.service.js';
import { computeScores, type Category, type Scores } from './scores.service.js';

const CATEGORIES: Category[] = ['bebidas', 'comida', 'postres'];

export interface PhotoDto {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  isMain: boolean;
  category: PhotoCategory;
}

export interface RatingDto {
  score: number | null;
  comment: string;
  highlights: string;
}

export interface EstablishmentDto {
  id: number;
  name: string;
  type: EstablishmentRow['type'];
  address: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  visitStatus: EstablishmentRow['visit_status'];
  visitDate: string | null;
  description: string;
  inPassport: boolean;
  offersDrinks: boolean;
  offersFood: boolean;
  offersDesserts: boolean;
  offersSugarFree: boolean;
  offersBoardGames: boolean;
  offersSeasonalDrinks: boolean;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  observations: string;
  consumed: { bebida: string; comida: string; postre: string };
  answers: Answers;
  detailScores: {
    cafe: number | null;
    bebidas: number | null;
    comida: number | null;
    ambiente: number | null;
    precios: number | null;
    atencion: number | null;
  };
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  mainPhoto: PhotoDto | null;
  ratings: Record<Category, RatingDto | null>;
  scores: Scores;
}

/** Una fila con respuestas ilegibles se muestra sin respuestas en lugar de romper toda la vista. */
function readAnswers(text: string): Answers {
  try {
    const parsed = answersSchema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
  } catch {
    /* Continúa con el valor vacío. */
  }
  return answersSchema.parse({});
}

export const toPhotoDto = (photo: PhotoRow): PhotoDto => ({
  id: photo.id,
  url: mediaUrl('establishments', photo.filename),
  thumbUrl: mediaUrl('establishments', photo.thumb_filename),
  width: photo.width,
  height: photo.height,
  isMain: photo.is_main === 1,
  category: photo.category,
});

export const toReviewDto = (review: ReviewRow) => ({
  id: review.id,
  establishmentId: review.establishment_id,
  friendId: review.friend_id,
  friendName: review.friend_name,
  score: review.score,
  comment: review.comment,
  ordered: review.ordered,
  answers: readAnswers(review.answers),
  visitDate: review.visit_date,
  photoUrl: review.photo_filename ? mediaUrl('reviews', review.photo_filename) : null,
  photoThumbUrl: review.photo_thumb_filename ? mediaUrl('reviews', review.photo_thumb_filename) : null,
  createdAt: review.created_at,
  updatedAt: review.updated_at,
});

/** Los aspectos que cuentan en mi calificación. La comida solo cuenta si el lugar la ofrece. */
const ratedAspects = (row: EstablishmentRow) => [
  row.score_cafe,
  row.score_bebidas,
  ...(row.offers_food === 1 ? [row.score_comida] : []),
  row.score_ambiente,
  row.score_precios,
  row.score_atencion,
];

function compose(
  row: EstablishmentRow,
  ratings: RatingRow[],
  mainPhoto: PhotoRow | undefined,
  reviewScores: (number | null)[],
): EstablishmentDto {
  const offers = {
    bebidas: row.offers_drinks === 1,
    comida: row.offers_food === 1,
    postres: row.offers_desserts === 1,
  };
  const ratingDtos: Record<Category, RatingDto | null> = { bebidas: null, comida: null, postres: null };
  const values: Partial<Record<Category, number | null>> = {};
  for (const rating of ratings) {
    ratingDtos[rating.category] = {
      score: rating.score,
      comment: rating.comment,
      highlights: rating.highlights,
    };
    values[rating.category] = rating.score;
  }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    address: row.address,
    neighborhood: row.neighborhood,
    latitude: row.latitude,
    longitude: row.longitude,
    visitStatus: row.visit_status,
    visitDate: row.visit_date,
    description: row.description,
    inPassport: row.in_passport === 1,
    offersDrinks: offers.bebidas,
    offersFood: offers.comida,
    offersDesserts: offers.postres,
    offersSugarFree: row.offers_sugar_free === 1,
    offersBoardGames: row.offers_board_games === 1,
    offersSeasonalDrinks: row.offers_seasonal_drinks === 1,
    googleMapsUrl: row.google_maps_url,
    googlePlaceId: row.google_place_id,
    observations: row.observations,
    consumed: { bebida: row.consumed_drink, comida: row.consumed_food, postre: row.consumed_dessert },
    answers: readAnswers(row.answers),
    detailScores: {
      cafe: row.score_cafe,
      bebidas: row.score_bebidas,
      comida: row.score_comida,
      ambiente: row.score_ambiente,
      precios: row.score_precios,
      atencion: row.score_atencion,
    },
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mainPhoto: mainPhoto ? toPhotoDto(mainPhoto) : null,
    ratings: ratingDtos,
    scores: computeScores(offers, values, reviewScores, ratedAspects(row)),
  };
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** Carga todo en cuatro consultas (sin N+1) y compone los DTO en memoria. */
export function loadAll(): EstablishmentDto[] {
  const ratings = groupBy(ratingModel.findAll(), (rating) => rating.establishment_id);
  const reviews = groupBy(reviewModel.findAll(), (review) => review.establishment_id);
  // findAll ordena las principales primero, así que la primera de cada grupo es la portada.
  const photos = groupBy(photoModel.findAll(), (photo) => photo.establishment_id);
  return establishmentModel.findAll().map((row) =>
    compose(
      row,
      ratings.get(row.id) ?? [],
      photos.get(row.id)?.[0],
      (reviews.get(row.id) ?? []).map((review) => review.score),
    ),
  );
}

/** Compara dejando los valores nulos siempre al final, sea cual sea la dirección. */
function compareNullable<T extends number | string>(a: T | null, b: T | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a === b) return 0;
  return (a < b ? -1 : 1) * direction;
}

const byName = (a: EstablishmentDto, b: EstablishmentDto) => a.name.localeCompare(b.name, 'es');

export function listEstablishments(query: EstablishmentQuery): EstablishmentDto[] {
  const search = query.q ? normalizeText(query.q) : '';

  const filtered = loadAll().filter((place) => {
    if (search && !normalizeText(place.name).includes(search)) return false;
    if (query.type && place.type !== query.type) return false;
    if (query.passport !== undefined && place.inPassport !== query.passport) return false;
    if (query.food !== undefined && place.offersFood !== query.food) return false;
    if (query.desserts !== undefined && place.offersDesserts !== query.desserts) return false;
    if (query.sugarFree !== undefined && place.offersSugarFree !== query.sugarFree) return false;
    if (query.boardGames !== undefined && place.offersBoardGames !== query.boardGames) return false;
    if (query.seasonalDrinks !== undefined && place.offersSeasonalDrinks !== query.seasonalDrinks) return false;
    if (query.visitStatus && place.visitStatus !== query.visitStatus) return false;
    if (query.minScore !== undefined && (place.scores.personal ?? 0) < query.minScore) return false;
    if (query.unrated && place.scores.personal !== null) return false;
    return true;
  });

  const defaults = { name: 'asc', visitDate: 'desc', score: 'desc', recent: 'desc' } as const;
  const direction: 1 | -1 = (query.dir ?? defaults[query.sort]) === 'asc' ? 1 : -1;
  const comparators = {
    name: (a: EstablishmentDto, b: EstablishmentDto) => byName(a, b) * direction,
    visitDate: (a: EstablishmentDto, b: EstablishmentDto) =>
      compareNullable(a.visitDate, b.visitDate, direction) || byName(a, b),
    score: (a: EstablishmentDto, b: EstablishmentDto) =>
      compareNullable(a.scores.personal, b.scores.personal, direction) || byName(a, b),
    recent: (a: EstablishmentDto, b: EstablishmentDto) =>
      compareNullable(a.createdAt, b.createdAt, direction) || (a.id - b.id) * direction,
  };
  return filtered.sort(comparators[query.sort]);
}

export function getEstablishment(id: number) {
  const row = establishmentModel.findById(id);
  if (!row) throw notFound('Lugar');
  const photos = photoModel.findByEstablishment(id);
  const reviews = reviewModel.findByEstablishment(id);
  const place = compose(
    row,
    ratingModel.findByEstablishment(id),
    photos[0],
    reviews.map((review) => review.score),
  );
  return {
    ...place,
    photos: photos.map(toPhotoDto),
    reviews: reviews.map(toReviewDto),
    availability: availabilityModel.findByEstablishment(id).map(toAvailabilityDto),
    seasonal: seasonalModel.findByEstablishment(id).map(toSeasonalDto),
  };
}

function ratingsToStore(
  ratings: NonNullable<EstablishmentInput['ratings']>,
  input: EstablishmentInput,
): Partial<Record<Category, RatingWrite>> {
  const offered: Record<Category, boolean> = {
    bebidas: input.offersDrinks,
    comida: input.offersFood,
    postres: input.offersDesserts,
  };
  const result: Partial<Record<Category, RatingWrite>> = {};
  for (const category of CATEGORIES) {
    const rating = ratings[category];
    if (!offered[category] || !rating) continue;
    if (rating.score === null && !rating.comment && !rating.highlights) continue;
    result[category] = rating;
  }
  return result;
}

export function createEstablishment(input: EstablishmentInput, options: { isDemo?: boolean } = {}) {
  const db = getDb();
  const id = db.transaction(() => {
    const newId = establishmentModel.insert({ ...input, isDemo: options.isDemo ?? false });
    if (input.ratings) ratingModel.replace(newId, ratingsToStore(input.ratings, input));
    return newId;
  })();
  return getEstablishment(id);
}

export function updateEstablishment(id: number, input: EstablishmentInput) {
  if (!establishmentModel.findById(id)) throw notFound('Lugar');
  const db = getDb();
  db.transaction(() => {
    establishmentModel.update(id, input);
    // Un lugar pendiente no conserva calificaciones; sin "ratings" las anteriores no se tocan.
    if (input.visitStatus === 'pendiente') ratingModel.replace(id, {});
    else if (input.ratings) ratingModel.replace(id, ratingsToStore(input.ratings, input));
  })();
  return getEstablishment(id);
}

/** Cambio rápido desde el Pasaporte. Un lugar con calificaciones no puede volver a pendiente. */
export function updateVisit(id: number, status: 'visitado' | 'pendiente', date: string | null) {
  const row = establishmentModel.findById(id);
  if (!row) throw notFound('Lugar');
  const hasScores = ratedAspects(row).some((score) => score !== null);
  if (status === 'pendiente' && (hasScores || ratingModel.findByEstablishment(id).length > 0)) {
    throw new HttpError(
      409,
      'Este lugar ya tiene calificaciones. Para marcarlo como pendiente, primero edítalo y quítaselas.',
    );
  }
  establishmentModel.updateVisit(id, status, status === 'pendiente' ? null : date);
  return getEstablishment(id);
}

/** Quien responde el cuestionario, califica o anota lo que consumió ya fue al lugar: deja de estar pendiente. */
export function updateNotes(id: number, input: NotesInput) {
  const row = establishmentModel.findById(id);
  if (!row) throw notFound('Lugar');
  const rated =
    Object.values(input.scores).some((score) => score !== null) ||
    Object.values(input.consumed).some((text) => text !== '');
  getDb().transaction(() => {
    establishmentModel.updateNotes(id, input);
    if (row.visit_status === 'pendiente' && (rated || hasAnswers(input.answers))) {
      establishmentModel.updateVisit(id, 'visitado', null);
    }
  })();
  return getEstablishment(id);
}

export function deleteEstablishment(id: number): void {
  if (!establishmentModel.findById(id)) throw notFound('Lugar');
  const photos = photoModel.findByEstablishment(id);
  const reviews = reviewModel.findByEstablishment(id);
  const seasonal = seasonalModel.findByEstablishment(id);
  const db = getDb();
  db.transaction(() => {
    establishmentModel.delete(id);
    friendModel.deleteOrphans();
  })();
  // Los archivos se borran después del commit: un fallo no deja filas sin su foto.
  for (const photo of photos) removeImage('establishments', photo.filename, photo.thumb_filename);
  for (const review of reviews) removeImage('reviews', review.photo_filename, review.photo_thumb_filename);
  for (const item of seasonal) removeImage('seasonal', item.photo_filename, item.photo_thumb_filename);
}

/** Colonias sin duplicados por acento o mayúsculas, con la primera escritura registrada. */
export function listNeighborhoods(): string[] {
  const unique = new Map<string, string>();
  for (const row of establishmentModel.findAll()) {
    const key = normalizeText(row.neighborhood);
    if (!key) continue;
    if (!unique.has(key)) unique.set(key, row.neighborhood);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es'));
}
