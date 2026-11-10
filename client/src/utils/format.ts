import type { Category, Consumed, Establishment, EstablishmentType, PhotoCategory } from '../types';

export const TYPE_LABELS: Record<EstablishmentType, string> = {
  cafeteria: 'Cafetería',
  panaderia: 'Panadería',
};

/** Para frases como "Nombre de la cafetería". */
export const TYPE_NOUNS: Record<EstablishmentType, string> = {
  cafeteria: 'cafetería',
  panaderia: 'panadería',
};

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'lugar', label: 'El lugar' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'comida', label: 'Comida' },
  { value: 'postres', label: 'Postres' },
];

export const EMPTY_CONSUMED: Consumed = { bebida: '', comida: '', postre: '' };

type Offers = { offersFood: boolean; offersDesserts: boolean };

/** La bebida siempre se puede anotar; comida y postre, solo si el lugar los ofrece. */
export function consumedFields(offers: Offers) {
  return [
    { key: 'bebida' as const, emoji: '🥤', title: 'Bebida', question: '¿Qué bebida tomaste?', shown: true },
    { key: 'comida' as const, emoji: '🍽️', title: 'Comida', question: '¿Qué comida probaste?', shown: offers.offersFood },
    { key: 'postre' as const, emoji: '🍰', title: 'Postre', question: '¿Qué postre probaste?', shown: offers.offersDesserts },
  ].filter((field) => field.shown);
}

/** Texto breve de ubicación. Un lugar guardado a medias puede no tener colonia ni dirección. */
export const placeArea = (place: { neighborhood: string; address: string }) =>
  place.neighborhood || place.address || 'Ubicación por completar';

/** El enlace guardado o, si solo hay coordenadas, el formato de URL oficial de Google Maps. */
export function googleMapsLink(place: Pick<Establishment, 'googleMapsUrl' | 'latitude' | 'longitude'>): string | null {
  if (place.googleMapsUrl) return place.googleMapsUrl;
  if (place.latitude === null || place.longitude === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  bebidas: 'Bebidas',
  comida: 'Comida',
  postres: 'Postres',
};

export const CATEGORIES: Category[] = ['bebidas', 'comida', 'postres'];

export const offersCategory = (place: Pick<Establishment, 'offersDrinks' | 'offersFood' | 'offersDesserts'>, category: Category) =>
  ({ bebidas: place.offersDrinks, comida: place.offersFood, postres: place.offersDesserts })[category];

export const formatScore = (score: number) => score.toFixed(1);

/** Las fechas de visita son días de calendario: se interpretan como locales, no como UTC. */
export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function todayLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
