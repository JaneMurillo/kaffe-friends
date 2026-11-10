interface ScoreInputProps {
  legend: string;
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  emptyLabel?: string;
}

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Escala del 1 al 10 con radios nativos. "Sin calificar" es una opción explícita. */
export function ScoreInput({ legend, name, value, onChange, error, emptyLabel = 'Sin calificar' }: ScoreInputProps) {
  return (
    <fieldset className={`score-input ${error ? 'field--error' : ''}`}>
      <legend className="field__label">{legend}</legend>
      <div className="score-input__options">
        {VALUES.map((option) => (
          <label
            key={option}
            className={`score-input__option ${value === option ? 'is-selected' : ''} ${
              value !== null && option <= value ? 'is-filled' : ''
            }`}
          >
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
        <label className={`score-input__none ${value === null ? 'is-selected' : ''}`}>
          <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
          <span>{emptyLabel}</span>
        </label>
      </div>
      {error && <p className="field__error">{error}</p>}
    </fieldset>
  );
}
