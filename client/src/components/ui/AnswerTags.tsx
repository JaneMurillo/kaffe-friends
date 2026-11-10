import type { Answers } from '../../types';
import { answerSummary, answerTags } from '../../utils/questionnaire';

/** Resumen de Mis notas: las respuestas clasificadas por tema, como una ficha. */
export function AnswerSummary({ answers }: { answers: Answers }) {
  const groups = answerSummary(answers);
  if (groups.length === 0) return null;
  return (
    <div className="answer-summary">
      {groups.map((group) => (
        <section key={group.title} className="answer-summary__group">
          <h3 className="answer-summary__title">{group.title}</h3>
          <dl className="answer-summary__list">
            {group.rows.map((row) => (
              <div key={row.key} className="answer-summary__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** Etiquetas generadas a partir de las respuestas del cuestionario. */
export function AnswerTags({ answers, keys, label = 'Etiquetas' }: { answers: Answers; keys?: (keyof Answers)[]; label?: string }) {
  const tags = answerTags(answers, keys);
  if (tags.length === 0) return null;
  return (
    <ul className="tags answer-tags" aria-label={label}>
      {tags.map((tag) => (
        <li key={tag.key} className="tag tag--answer">
          {tag.emoji && <span aria-hidden="true">{tag.emoji} </span>}
          {tag.label}
        </li>
      ))}
    </ul>
  );
}
