import { useId, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Recibe los atributos que conectan el control con su etiqueta, ayuda y error. */
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__required"> (obligatorio)</span>}
      </label>
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })}
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

/** Grupo de opciones tipo botón, basado en radios nativos para conservar el teclado. */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: ChoiceOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <fieldset className={`choice ${error ? 'field--error' : ''}`}>
      <legend className="field__label">{legend}</legend>
      <div className="choice__options">
        {options.map((option) => (
          <label key={option.value} className={`choice__option ${value === option.value ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="field__error">{error}</p>}
    </fieldset>
  );
}

const YES_NO: ChoiceOption<'si' | 'no'>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

export function YesNo({
  legend,
  name,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <ChoiceGroup
      legend={legend}
      name={name}
      options={YES_NO}
      value={value ? 'si' : 'no'}
      onChange={(choice) => onChange(choice === 'si')}
      error={error}
    />
  );
}
