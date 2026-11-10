import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { ApiError, api } from '../../services/api';
import type { Answers, Review } from '../../types';
import { todayLocal } from '../../utils/format';
import { EMPTY_ANSWERS, FRIEND_QUESTIONS, hasAnyAnswer } from '../../utils/questionnaire';
import { useFeedback } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ScoreInput } from '../ui/ScoreInput';
import { QuestionList } from './Questionnaire';

interface ReviewFormProps {
  establishmentId: number;
  review?: Review;
  onClose: () => void;
  onSaved: () => void;
}

export function ReviewForm({ establishmentId, review, onClose, onSaved }: ReviewFormProps) {
  const { toast } = useFeedback();
  const [friendName, setFriendName] = useState(review?.friendName ?? '');
  const [score, setScore] = useState<number | null>(review?.score ?? null);
  const [answers, setAnswers] = useState<Answers>(review?.answers ?? EMPTY_ANSWERS);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [ordered, setOrdered] = useState(review?.ordered ?? '');
  const [visitDate, setVisitDate] = useState(review?.visitDate ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { data: friends } = useAsync(() => api.friends(), []);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shownPhoto = preview ?? (removePhoto ? null : review?.photoThumbUrl ?? null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!friendName.trim()) found.friendName = 'Escribe el nombre de tu amigo o amiga.';
    if (score === null && !comment.trim() && !ordered.trim() && !hasAnyAnswer(answers)) {
      found.score = 'Responde alguna pregunta, o agrega lo que pidió, una calificación o un comentario.';
    }
    if (visitDate && visitDate > todayLocal()) found.visitDate = 'La fecha no puede estar en el futuro.';
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    const input = { friendName, score, comment, ordered, answers, visitDate: visitDate || null, photo, removePhoto };
    try {
      if (review) await api.updateReview(review.id, input);
      else await api.createReview(establishmentId, input);
      toast(review ? 'Opinión actualizada.' : 'Opinión agregada.');
      onSaved();
    } catch (error) {
      // Dentro de un diálogo el error va en línea: un aviso flotante quedaría detrás del fondo.
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
      else setErrors({ form: (error as Error).message });
      setSaving(false);
    }
  };

  return (
    <Modal title={review ? 'Editar opinión' : 'Agregar opinión de un amigo'} onClose={onClose}>
      <form className="review-form" onSubmit={submit} noValidate>
        <Field label="Nombre o apodo" required error={errors.friendName}>
          {(props) => (
            <>
              <input
                {...props}
                className="input"
                list="amigos"
                maxLength={100}
                autoFocus
                value={friendName}
                onChange={(event) => setFriendName(event.target.value)}
              />
              <datalist id="amigos">{friends?.map((friend) => <option key={friend.id} value={friend.name} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="¿Qué pidió de comer o beber?" hint="Opcional." error={errors.ordered}>
          {(props) => <input {...props} className="input" maxLength={300} value={ordered} onChange={(event) => setOrdered(event.target.value)} />}
        </Field>
        <QuestionList answers={answers} onChange={setAnswers} keys={FRIEND_QUESTIONS} name="amigo" />
        <ScoreInput
          legend="Calificación final (opcional)"
          name="calificacion-amigo"
          value={score}
          onChange={setScore}
          error={errors.score}
          emptyLabel="Sin calificación"
        />
        <Field label="Comentario adicional (opcional)" error={errors.comment}>
          {(props) => (
            <textarea {...props} className="input" rows={3} maxLength={4000} value={comment} onChange={(event) => setComment(event.target.value)} />
          )}
        </Field>
        <Field label="Fecha de visita (opcional)" error={errors.visitDate}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="date"
              max={todayLocal()}
              value={visitDate}
              onChange={(event) => setVisitDate(event.target.value)}
            />
          )}
        </Field>
        <Field label="Fotografía de su experiencia (opcional)">
          {(props) => (
            <input
              {...props}
              className="input input--file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                setPhoto(event.target.files?.[0] ?? null);
                setRemovePhoto(false);
              }}
            />
          )}
        </Field>
        {shownPhoto && (
          <div className="review-form__photo">
            <img src={shownPhoto} alt="Fotografía de la opinión" />
            {!photo && (
              <button type="button" className="link-btn" onClick={() => setRemovePhoto(true)}>
                Quitar fotografía
              </button>
            )}
          </div>
        )}
        {errors.form && (
          <p className="field__error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar opinión'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
