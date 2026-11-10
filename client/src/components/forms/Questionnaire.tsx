import type { Answers, Consumed, DetailScores } from '../../types';
import { consumedFields, formatScore } from '../../utils/format';
import { QUESTIONS, QUESTION_GROUPS } from '../../utils/questionnaire';
import { Field } from '../ui/Field';
import { QuickChoice } from '../ui/QuickChoice';
import { ScoreInput } from '../ui/ScoreInput';

export const ASPECTS: { key: keyof DetailScores; label: string; hint?: string }[] = [
  { key: 'cafe', label: 'Café' },
  { key: 'bebidas', label: 'Bebidas' },
  { key: 'comida', label: 'Comida' },
  { key: 'ambiente', label: 'Ambiente' },
  { key: 'precios', label: 'Precios', hint: '10 = muy buena relación entre calidad y precio.' },
  { key: 'atencion', label: 'Atención' },
];

export const EMPTY_SCORES: DetailScores = { cafe: null, bebidas: null, comida: null, ambiente: null, precios: null, atencion: null };

/** La comida solo se califica si el lugar la ofrece. */
export const aspectsFor = (offers: { offersFood: boolean }) => ASPECTS.filter((aspect) => aspect.key !== 'comida' || offers.offersFood);

export function averageOf(scores: DetailScores, offers: { offersFood: boolean }): number | null {
  const rated = aspectsFor(offers)
    .map((aspect) => scores[aspect.key])
    .filter((score): score is number => score !== null);
  return rated.length ? rated.reduce((sum, score) => sum + score, 0) / rated.length : null;
}

/** Actualiza una respuesta conservando el tipo que corresponde a su pregunta. */
function withAnswer(answers: Answers, key: keyof Answers, value: string | string[] | null): Answers {
  return { ...answers, [key]: value } as Answers;
}

export function QuestionList({
  answers,
  onChange,
  keys,
  name,
}: {
  answers: Answers;
  onChange: (answers: Answers) => void;
  keys: (keyof Answers)[];
  name: string;
}) {
  return (
    <>
      {keys.map((key) => (
        <QuickChoice
          key={key}
          name={name}
          question={QUESTIONS[key]}
          value={answers[key]}
          onChange={(value) => onChange(withAnswer(answers, key, value))}
        />
      ))}
    </>
  );
}

export function Questionnaire({ answers, onChange, name }: { answers: Answers; onChange: (answers: Answers) => void; name: string }) {
  return (
    <div className="questionnaire">
      {QUESTION_GROUPS.map((group) => (
        <section key={group.title} className="question-group">
          <h3 className="question-group__title">{group.title}</h3>
          <QuestionList answers={answers} onChange={onChange} keys={group.keys} name={name} />
        </section>
      ))}
    </div>
  );
}

export function ConsumedInputs({
  consumed,
  offers,
  onChange,
}: {
  consumed: Consumed;
  offers: { offersFood: boolean; offersDesserts: boolean };
  onChange: (consumed: Consumed) => void;
}) {
  return (
    <section className="question-group">
      <h3 className="question-group__title">Lo que consumí</h3>
      <div className="form-grid">
        {consumedFields(offers).map((field) => (
          <Field key={field.key} label={field.question} hint="Opcional.">
            {(props) => (
              <input
                {...props}
                className="input"
                maxLength={300}
                value={consumed[field.key]}
                onChange={(event) => onChange({ ...consumed, [field.key]: event.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
    </section>
  );
}

export function AspectScores({
  scores,
  offers,
  onChange,
  errors = {},
  name,
}: {
  scores: DetailScores;
  offers: { offersFood: boolean };
  onChange: (scores: DetailScores) => void;
  errors?: Record<string, string>;
  name: string;
}) {
  const general = averageOf(scores, offers);
  return (
    <div className="aspect-scores">
      <p className="form-preview" aria-live="polite">
        Calificación general: <strong>{general === null ? 'Sin calificar' : formatScore(general)}</strong>
      </p>
      {aspectsFor(offers).map((aspect) => (
        <div key={aspect.key}>
          <ScoreInput
            legend={aspect.label}
            name={`${name}-${aspect.key}`}
            value={scores[aspect.key]}
            onChange={(score) => onChange({ ...scores, [aspect.key]: score })}
            error={errors[`scores.${aspect.key}`]}
          />
          {aspect.hint && <p className="field__hint">{aspect.hint}</p>}
        </div>
      ))}
    </div>
  );
}
