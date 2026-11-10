import type { Question } from '../../utils/questionnaire';

interface QuickChoiceProps {
  question: Question;
  name: string;
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
}

/**
 * Pregunta de un toque con opciones en forma de botón. Usa controles nativos para conservar el
 * teclado y los lectores de pantalla. Tocar de nuevo la opción elegida deja la pregunta sin responder.
 */
export function QuickChoice({ question, name, value, onChange }: QuickChoiceProps) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  const toggle = (option: string) => {
    if (question.multiple) {
      onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
    } else {
      onChange(selected.includes(option) ? null : option);
    }
  };

  return (
    <fieldset className="quick">
      <legend className="quick__title">
        {question.title}
        {question.multiple && <span className="quick__hint"> Elige varias si quieres.</span>}
      </legend>
      <div className="quick__options">
        {question.options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <label key={option.value} className={`quick__option ${isSelected ? 'is-selected' : ''}`}>
              <input
                type={question.multiple ? 'checkbox' : 'radio'}
                name={`${name}-${question.key}`}
                checked={isSelected}
                onChange={() => {
                  if (question.multiple || !isSelected) toggle(option.value);
                }}
                onClick={() => {
                  // Un radio marcado no dispara "change": así se puede quitar la respuesta.
                  if (!question.multiple && isSelected) toggle(option.value);
                }}
              />
              <span>
                {option.emoji && <span aria-hidden="true">{option.emoji} </span>}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
