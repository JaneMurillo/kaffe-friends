import type { Answers } from '../types';

export interface QuestionOption {
  value: string;
  emoji?: string;
  label: string;
  /** Texto de la etiqueta en la ficha, cuando la opción sola no se entiende fuera de la pregunta. */
  tag?: string;
  /** Texto en el resumen de Mis notas, cuando es más breve que la opción. */
  short?: string;
}

export interface Question {
  key: keyof Answers;
  title: string;
  /** Nombre del dato en el resumen de Mis notas. */
  summary: string;
  multiple?: boolean;
  options: QuestionOption[];
}

export const QUESTIONS: Record<keyof Answers, Question> = {
  ambiente: {
    key: 'ambiente',
    title: '¿Cómo describirías el ambiente?',
    summary: 'Ambiente',
    multiple: true,
    options: [
      { value: 'acogedor', emoji: '🌿', label: 'Acogedor' },
      { value: 'minimalista', emoji: '🤍', label: 'Minimalista' },
      { value: 'moderno', emoji: '✨', label: 'Moderno' },
      { value: 'tranquilo', emoji: '📖', label: 'Tranquilo' },
      { value: 'movido', emoji: '🎶', label: 'Movido' },
    ],
  },
  cafe: {
    key: 'cafe',
    title: '¿Qué tal estuvieron las bebidas?',
    summary: 'Bebidas',
    options: [
      { value: 'excelente', emoji: '😍', label: 'Excelentes', tag: 'Bebidas excelentes' },
      { value: 'bueno', emoji: '☕', label: 'Buenas', tag: 'Bebidas buenas' },
      { value: 'regular', emoji: '😐', label: 'Regulares', tag: 'Bebidas regulares' },
      { value: 'no_encanto', emoji: '😕', label: 'No me encantaron', tag: 'Las bebidas no me encantaron' },
      { value: 'no_probe', emoji: '🤷', label: 'No lo probé', tag: 'No probé las bebidas' },
    ],
  },
  precios: {
    key: 'precios',
    title: '¿Cómo estuvieron los precios?',
    summary: 'Precios',
    options: [
      { value: 'accesibles', emoji: '💸', label: 'Accesibles', tag: 'Precios accesibles' },
      { value: 'razonables', emoji: '👌', label: 'Razonables', tag: 'Precios razonables' },
      { value: 'elevados', emoji: '💰', label: 'Un poco elevados', tag: 'Precios un poco elevados' },
      { value: 'caros', emoji: '🤑', label: 'Caros', tag: 'Precios caros' },
    ],
  },
  favorito: {
    key: 'favorito',
    title: '¿Qué fue lo que más te gustó?',
    summary: 'Lo mejor',
    options: [
      { value: 'cafe', emoji: '☕', label: 'El café', tag: 'Lo mejor: el café' },
      { value: 'bebidas', emoji: '🍹', label: 'Las bebidas', tag: 'Lo mejor: las bebidas' },
      { value: 'alimentos', emoji: '🥐', label: 'Los alimentos', tag: 'Lo mejor: los alimentos' },
      { value: 'postres', emoji: '🍰', label: 'Los postres', tag: 'Lo mejor: los postres' },
      { value: 'ambiente', emoji: '🛋️', label: 'El ambiente', tag: 'Lo mejor: el ambiente' },
      { value: 'decoracion', emoji: '🪴', label: 'La decoración', tag: 'Lo mejor: la decoración' },
      { value: 'atencion', emoji: '💁', label: 'La atención', tag: 'Lo mejor: la atención' },
      { value: 'ubicacion', emoji: '📍', label: 'La ubicación', tag: 'Lo mejor: la ubicación' },
    ],
  },
  atencion: {
    key: 'atencion',
    title: '¿Cómo estuvo la atención?',
    summary: 'Atención',
    options: [
      { value: 'excelente', emoji: '⭐', label: 'Excelente', tag: 'Atención excelente' },
      { value: 'buena', emoji: '🙂', label: 'Buena', tag: 'Atención buena' },
      { value: 'regular', emoji: '😐', label: 'Regular', tag: 'Atención regular' },
      { value: 'mala', emoji: '👎', label: 'Mala', tag: 'Atención mala' },
    ],
  },
  trabajo: {
    key: 'trabajo',
    title: '¿Qué tan cómodo es el lugar para trabajar o estudiar?',
    summary: 'Para trabajar',
    options: [
      { value: 'ideal', emoji: '💻', label: 'Ideal', tag: 'Ideal para trabajar' },
      { value: 'comodo', emoji: '👍', label: 'Cómodo', tag: 'Cómodo para trabajar' },
      { value: 'regular', emoji: '😐', label: 'Regular', tag: 'Regular para trabajar' },
      { value: 'no_recomendado', emoji: '🚫', label: 'No lo recomendaría', tag: 'No es para trabajar' },
    ],
  },
  volveria: {
    key: 'volveria',
    title: '¿Volverías?',
    summary: '¿Volvería?',
    options: [
      { value: 'si', label: 'Sí', tag: 'Volvería' },
      { value: 'tal_vez', label: 'Tal vez', tag: 'Tal vez volvería' },
      { value: 'no', label: 'No', tag: 'No volvería' },
    ],
  },
  productos: {
    key: 'productos',
    title: '¿Qué tipo de productos ofrece?',
    summary: 'También tiene',
    multiple: true,
    options: [
      { value: 'postres', emoji: '🍰', label: 'Tiene postres', short: 'Postres' },
      { value: 'sin_azucar', emoji: '🥤', label: 'Tiene bebidas sin azúcar', short: 'Bebidas sin azúcar' },
    ],
  },
};

/** Las ocho preguntas, agrupadas para que el cuestionario no se sienta largo. */
export const QUESTION_GROUPS: { title: string; keys: (keyof Answers)[] }[] = [
  { title: 'El lugar', keys: ['ambiente', 'trabajo', 'favorito'] },
  { title: 'La experiencia', keys: ['cafe', 'atencion', 'precios'] },
  { title: 'Para la próxima', keys: ['productos', 'volveria'] },
];

/** Versión breve para que un amigo opine en segundos. */
export const FRIEND_QUESTIONS: (keyof Answers)[] = ['cafe', 'ambiente', 'atencion', 'precios', 'volveria'];

export const EMPTY_ANSWERS: Answers = {
  ambiente: [],
  cafe: null,
  precios: null,
  favorito: null,
  atencion: null,
  trabajo: null,
  volveria: null,
  productos: [],
};

export const hasAnyAnswer = (answers: Answers) =>
  Object.values(answers).some((value) => (Array.isArray(value) ? value.length > 0 : value !== null));

const selectedOptions = (answers: Answers, key: keyof Answers): QuestionOption[] => {
  const raw = answers[key];
  const selected: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return QUESTIONS[key].options.filter((option) => selected.includes(option.value));
};

export interface SummaryGroup {
  title: string;
  rows: { key: string; label: string; value: string }[];
}

/** Las respuestas clasificadas por tema, solo con lo contestado, para leerlas de un vistazo. */
export function answerSummary(answers: Answers): SummaryGroup[] {
  return QUESTION_GROUPS.map((group) => ({
    title: group.title,
    rows: group.keys.flatMap((key) => {
      const options = selectedOptions(answers, key);
      if (options.length === 0) return [];
      return [{ key, label: QUESTIONS[key].summary, value: options.map((option) => option.short ?? option.label).join(', ') }];
    }),
  })).filter((group) => group.rows.length > 0);
}

export interface AnswerTag {
  key: string;
  emoji?: string;
  label: string;
}

/** Convierte las respuestas en etiquetas, en el orden en que se muestran las preguntas. */
export function answerTags(answers: Answers, keys?: (keyof Answers)[]): AnswerTag[] {
  const order = keys ?? QUESTION_GROUPS.flatMap((group) => group.keys);
  return order.flatMap((key) => {
    return selectedOptions(answers, key)
      .map((option) => ({ key: `${key}-${option.value}`, emoji: option.emoji, label: option.tag ?? option.label }));
  });
}
