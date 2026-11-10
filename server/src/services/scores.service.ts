/**
 * Reglas de puntuación. Son funciones puras para poder probarlas de forma aislada.
 *
 * - Mi calificación: promedio de café, bebidas, comida, ambiente, precios y atención que estén
 *   calificados. Los lugares que solo tienen calificaciones anteriores por categoría conservan
 *   su promedio por categorías que aplican, hasta que se califique algún aspecto nuevo.
 * - Promedio de amigos: promedio de las opiniones que tienen calificación.
 * - Comunitaria: cada persona pesa lo mismo (mi calificación + una por opinión).
 *
 * Una categoría que no aplica o sin calificar se excluye; nunca cuenta como cero.
 */
export type Category = 'bebidas' | 'comida' | 'postres';

export interface Offers {
  bebidas: boolean;
  comida: boolean;
  postres: boolean;
}

export interface Scores {
  personal: number | null;
  friends: number | null;
  community: number | null;
  /** Opiniones que cuentan en los promedios (las que tienen calificación). */
  friendCount: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Promedio sin redondear de las categorías que aplican y están calificadas. */
function exactPersonal(offers: Offers, ratings: Partial<Record<Category, number | null>>): number | null {
  const applicable = (Object.keys(offers) as Category[])
    .filter((category) => offers[category])
    .map((category) => ratings[category])
    .filter((score): score is number => score !== null && score !== undefined);
  if (applicable.length === 0) return null;
  return applicable.reduce((sum, value) => sum + value, 0) / applicable.length;
}

export function personalScore(
  offers: Offers,
  ratings: Partial<Record<Category, number | null>>,
): number | null {
  const exact = exactPersonal(offers, ratings);
  return exact === null ? null : round(exact);
}

export function computeScores(
  offers: Offers,
  ratings: Partial<Record<Category, number | null>>,
  reviewScores: readonly (number | null)[],
  aspects: readonly (number | null)[] = [],
): Scores {
  const rated = aspects.filter((score): score is number => score !== null);
  const personalExact =
    rated.length > 0 ? rated.reduce((sum, value) => sum + value, 0) / rated.length : exactPersonal(offers, ratings);
  const friendScores = reviewScores.filter((score): score is number => score !== null);
  // Promedio sobre personas, no sobre "mi promedio" y "promedio de amigos".
  // Se usa el valor sin redondear para que el redondeo no se acumule.
  const everyone = personalExact === null ? friendScores : [personalExact, ...friendScores];
  return {
    personal: personalExact === null ? null : round(personalExact),
    friends: average(friendScores),
    community: average(everyone),
    friendCount: friendScores.length,
  };
}
