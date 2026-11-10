import { formatScore } from '../../utils/format';

interface ScoreBadgeProps {
  score: number | null;
  size?: 'small' | 'medium' | 'large';
  label?: string;
  /** Texto cuando no hay valor; por defecto "Sin calificar". */
  emptyLabel?: string;
}

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Medalla circular: el anillo se llena según la calificación sobre 10. */
export function ScoreBadge({ score, size = 'medium', label, emptyLabel = 'Sin calificar' }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span className={`score score--${size} score--empty`} title={label}>
        <span className="score__empty-text">{emptyLabel}</span>
      </span>
    );
  }
  const accessible = `${label ? `${label}: ` : ''}${formatScore(score)} de 10`;
  return (
    <span className={`score score--${size}`} role="img" aria-label={accessible} title={accessible}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className="score__ring">
        <circle cx="50" cy="50" r={RADIUS} className="score__track" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          className="score__value"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - score / 10)}
        />
      </svg>
      <span className="score__number">{formatScore(score)}</span>
    </span>
  );
}
