import { z } from 'zod';
import { isGoogleMapsUrl } from '../services/googleMapsLink.js';
import { todayLocal } from '../utils.js';

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const pastDate = z
  .string()
  .refine(isRealDate, 'La fecha no es válida.')
  .refine((value) => value <= todayLocal(), 'La fecha no puede estar en el futuro.');

const requiredText = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} es obligatorio.` })
    .trim()
    .min(1, `${label} es obligatorio.`)
    .max(max, `${label} no puede superar ${max} caracteres.`);

const optionalText = (max = 4000) => z.string().trim().max(max, `Máximo ${max} caracteres.`).default('');

const score = z
  .number({ invalid_type_error: 'La calificación debe ser un número.' })
  .int('La calificación debe ser un número entero.')
  .min(1, 'La calificación mínima es 1.')
  .max(10, 'La calificación máxima es 10.');

const ratingSchema = z.object({
  score: score.nullable().default(null),
  comment: optionalText(),
  highlights: optionalText(500),
});

const unique = <T extends string>(values: T[]) => [...new Set(values)];

/** Respuestas del cuestionario rápido. Se usa en mis notas y en las opiniones de amigos. */
export const answersSchema = z
  .object({
    ambiente: z.array(z.enum(['acogedor', 'minimalista', 'moderno', 'tranquilo', 'movido'])).default([]).transform(unique),
    cafe: z.enum(['excelente', 'bueno', 'regular', 'no_encanto', 'no_probe']).nullable().default(null),
    precios: z.enum(['accesibles', 'razonables', 'elevados', 'caros']).nullable().default(null),
    favorito: z.enum(['cafe', 'bebidas', 'alimentos', 'postres', 'ambiente', 'decoracion', 'atencion', 'ubicacion']).nullable().default(null),
    atencion: z.enum(['excelente', 'buena', 'regular', 'mala']).nullable().default(null),
    trabajo: z.enum(['ideal', 'comodo', 'regular', 'no_recomendado']).nullable().default(null),
    volveria: z.enum(['si', 'tal_vez', 'no']).nullable().default(null),
    productos: z.array(z.enum(['postres', 'sin_azucar'])).default([]).transform(unique),
  })
  .default({});

export type Answers = z.infer<typeof answersSchema>;

export const hasAnswers = (answers: Answers) =>
  Object.values(answers).some((value) => (Array.isArray(value) ? value.length > 0 : value !== null));

const detailScoresSchema = z
  .object({
    cafe: score.nullable().default(null),
    bebidas: score.nullable().default(null),
    comida: score.nullable().default(null),
    ambiente: score.nullable().default(null),
    precios: score.nullable().default(null),
    atencion: score.nullable().default(null),
  })
  .default({});

const blankStringToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

/** Lo que consumí en la visita. Texto libre: puede ser más de un producto. */
const consumedSchema = z
  .object({ bebida: optionalText(300), comida: optionalText(300), postre: optionalText(300) })
  .default({});

export const notesSchema = z.object({
  observations: optionalText(),
  consumed: consumedSchema,
  answers: answersSchema,
  scores: detailScoresSchema,
});

export type NotesInput = z.infer<typeof notesSchema>;

export const establishmentSchema = z
  .object({
    name: requiredText('El nombre'),
    type: z.enum(['cafeteria', 'panaderia'], {
      errorMap: () => ({ message: 'Elige si es cafetería o panadería.' }),
    }),
    address: optionalText(300),
    neighborhood: optionalText(120),
    latitude: z.number().min(-90, 'Latitud fuera de rango.').max(90, 'Latitud fuera de rango.').nullable().default(null),
    longitude: z
      .number()
      .min(-180, 'Longitud fuera de rango.')
      .max(180, 'Longitud fuera de rango.')
      .nullable()
      .default(null),
    visitStatus: z.enum(['visitado', 'pendiente'], {
      errorMap: () => ({ message: 'Indica si ya fue visitado o está pendiente.' }),
    }),
    visitDate: pastDate.nullable().default(null),
    description: optionalText(),
    inPassport: z.boolean().default(false),
    offersDrinks: z.boolean().default(true),
    offersFood: z.boolean().default(false),
    offersDesserts: z.boolean().default(false),
    offersSugarFree: z.boolean().default(false),
    offersBoardGames: z.boolean().default(false),
    offersSeasonalDrinks: z.boolean().default(false),
    googleMapsUrl: z.preprocess(
      blankStringToNull,
      z.string().trim().max(2048).refine(isGoogleMapsUrl, 'Debe ser un enlace de Google Maps.').nullable().default(null),
    ),
    googlePlaceId: z.preprocess(
      blankStringToNull,
      z.string().regex(/^[\w-]{1,300}$/, 'El identificador del lugar no es válido.').nullable().default(null),
    ),
    observations: optionalText(),
    consumed: consumedSchema,
    answers: answersSchema,
    scores: detailScoresSchema,
    // Calificaciones anteriores por categoría. Si no se envían, las guardadas se conservan.
    ratings: z
      .object({
        bebidas: ratingSchema.optional(),
        comida: ratingSchema.optional(),
        postres: ratingSchema.optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    if ((data.latitude === null) !== (data.longitude === null)) {
      issue(['latitude'], 'Indica latitud y longitud juntas, o deja ambas vacías.');
    }
    if (data.visitStatus === 'pendiente' && data.visitDate) {
      issue(['visitDate'], 'Un lugar pendiente todavía no tiene fecha de visita.');
    }
    if (data.visitStatus === 'pendiente') {
      for (const aspect of ['cafe', 'bebidas', 'comida', 'ambiente', 'precios', 'atencion'] as const) {
        if (data.scores[aspect] !== null) issue(['scores', aspect], 'Un lugar pendiente todavía no se puede calificar.');
      }
    }
    // Una categoría que el lugar no ofrece no se puede calificar.
    const offered = { bebidas: data.offersDrinks, comida: data.offersFood, postres: data.offersDesserts };
    for (const category of ['bebidas', 'comida', 'postres'] as const) {
      const rating = data.ratings?.[category];
      if (!rating) continue;
      const hasContent = rating.score !== null || rating.comment !== '' || rating.highlights !== '';
      if (hasContent && !offered[category]) {
        issue(['ratings', category, 'score'], `No se puede calificar ${category}: el lugar no lo ofrece.`);
      }
      if (hasContent && data.visitStatus === 'pendiente') {
        issue(['ratings', category, 'score'], 'Un lugar pendiente todavía no se puede calificar.');
      }
    }
  });

export type EstablishmentInput = z.infer<typeof establishmentSchema>;

const queryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const establishmentQuerySchema = z.object({
  q: z.string().trim().optional(),
  type: z.enum(['cafeteria', 'panaderia']).optional(),
  minScore: z.coerce.number().min(1).max(10).optional(),
  unrated: queryBoolean,
  passport: queryBoolean,
  food: queryBoolean,
  desserts: queryBoolean,
  sugarFree: queryBoolean,
  boardGames: queryBoolean,
  seasonalDrinks: queryBoolean,
  visitStatus: z.enum(['visitado', 'pendiente']).optional(),
  sort: z.enum(['name', 'visitDate', 'score', 'recent']).default('recent'),
  dir: z.enum(['asc', 'desc']).optional(),
});

export type EstablishmentQuery = z.infer<typeof establishmentQuerySchema>;

export const rankingQuerySchema = z.object({
  kind: z.enum(['personal', 'community']).default('personal'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export const visitSchema = z
  .object({
    visitStatus: z.enum(['visitado', 'pendiente']),
    visitDate: pastDate.nullable().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.visitStatus === 'visitado' && !data.visitDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visitDate'], message: 'Indica la fecha de visita.' });
    }
  });

/** Llega como multipart: todos los campos son texto y una cadena vacía significa "sin valor". */
const blankToNull = (value: unknown) => (value === '' || value === undefined ? null : value);

/** En multipart, las respuestas viajan como texto JSON. Si está dañado, Zod lo rechaza. */
const parseJsonField = (value: unknown) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const reviewSchema = z
  .object({
    friendName: requiredText('El nombre del amigo', 100),
    score: z.preprocess((value) => {
      const clean = blankToNull(value);
      return clean === null ? null : Number(clean);
    }, score.nullable()),
    comment: optionalText(),
    ordered: optionalText(300),
    answers: z.preprocess(parseJsonField, answersSchema),
    visitDate: z.preprocess(blankToNull, pastDate.nullable()),
    removePhoto: z.preprocess((value) => value === 'true' || value === true, z.boolean()),
  })
  .superRefine((data, ctx) => {
    if (data.score === null && data.comment === '' && data.ordered === '' && !hasAnswers(data.answers)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: 'Responde alguna pregunta, o agrega lo que pidió, una calificación o un comentario.',
      });
    }
  });

export const availabilitySchema = z.object({
  productName: requiredText('El nombre del producto', 150),
  note: optionalText(500),
  availableWhen: optionalText(200),
  sellsOutFast: z.boolean().default(false),
});

export const seasonalSchema = z.object({
  name: requiredText('El nombre del producto', 150),
  triedOn: z.string({ required_error: 'Indica cuándo lo probaste.' }).pipe(pastDate),
  note: optionalText(1000),
  status: z.enum(['disponible', 'temporal'], { errorMap: () => ({ message: 'Indica si sigue disponible o fue temporal.' }) }),
  removePhoto: z.preprocess((value) => value === 'true' || value === true, z.boolean()),
});

export const photoCategorySchema = z.enum(['lugar', 'bebidas', 'comida', 'postres'], {
  errorMap: () => ({ message: 'La categoría de la fotografía no es válida.' }),
});

export const googleLinkSchema = z.object({
  url: z.string({ required_error: 'Pega un enlace de Google Maps.' }).trim().min(1, 'Pega un enlace de Google Maps.').max(2048),
});

export const idParam = z.coerce.number().int().positive();
