import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError, api } from '../../services/api';
import type { Answers, AvailabilityItem, Consumed, DetailScores, EstablishmentDetail, SeasonalProduct } from '../../types';
import { todayLocal } from '../../utils/format';
import { hasAnyAnswer } from '../../utils/questionnaire';
import { ChoiceGroup, Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { AspectScores, ConsumedInputs, Questionnaire } from './Questionnaire';

type Errors = Record<string, string>;

function readErrors(error: unknown): Errors {
  if (error instanceof ApiError && Object.keys(error.fields).length > 0) return error.fields;
  return { form: (error as Error).message };
}

function FormActions({ saving, label, error, onClose }: { saving: boolean; label: string; error?: string; onClose: () => void }) {
  return (
    <>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Guardando…' : label}
        </button>
      </div>
    </>
  );
}

export function NotesForm({ place, onClose, onSaved }: { place: EstablishmentDetail; onClose: () => void; onSaved: () => void }) {
  const [answers, setAnswers] = useState<Answers>(place.answers);
  const [scores, setScores] = useState<DetailScores>(place.detailScores);
  const [observations, setObservations] = useState(place.observations);
  const [consumed, setConsumed] = useState<Consumed>(place.consumed);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const willMarkVisited =
    place.visitStatus === 'pendiente' && (hasAnyAnswer(answers) ||
      Object.values(scores).some((score) => score !== null) ||
      Object.values(consumed).some((text) => text.trim() !== ''));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateNotes(place.id, { answers, scores, observations, consumed });
      onSaved();
    } catch (error) {
      setErrors(readErrors(error));
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar mis notas" onClose={onClose}>
      <form className="review-form" onSubmit={submit} noValidate>
        <ConsumedInputs consumed={consumed} offers={place} onChange={setConsumed} />
        <Questionnaire answers={answers} onChange={setAnswers} name="notas" />
        <Field label="Observaciones personales" hint="Opcional.">
          {(props) => (
            <textarea
              {...props}
              className="input"
              rows={3}
              maxLength={4000}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
            />
          )}
        </Field>
        <section className="question-group">
          <h3 className="question-group__title">Calificaciones</h3>
          <AspectScores scores={scores} offers={place} onChange={setScores} errors={errors} name="notas-calificacion" />
        </section>
        {willMarkVisited && <p className="form-section__help">Al guardar, este lugar dejará de estar pendiente.</p>}
        <FormActions saving={saving} label="Guardar mis notas" error={errors.form} onClose={onClose} />
      </form>
    </Modal>
  );
}

export function AvailabilityForm({
  establishmentId,
  item,
  onClose,
  onSaved,
}: {
  establishmentId: number;
  item?: AvailabilityItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [productName, setProductName] = useState(item?.productName ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [availableWhen, setAvailableWhen] = useState(item?.availableWhen ?? '');
  const [sellsOutFast, setSellsOutFast] = useState(item?.sellsOutFast ?? false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!productName.trim()) {
      setErrors({ productName: 'Escribe el nombre del producto.' });
      return;
    }
    setSaving(true);
    const input = { productName, note, availableWhen, sellsOutFast };
    try {
      if (item) await api.updateAvailability(item.id, input);
      else await api.createAvailability(establishmentId, input);
      onSaved();
    } catch (error) {
      setErrors(readErrors(error));
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? 'Editar disponibilidad' : 'Agregar a Disponibilidad'} onClose={onClose}>
      <form className="review-form" onSubmit={submit} noValidate>
        <Field label="Nombre del producto" required error={errors.productName}>
          {(props) => (
            <input {...props} className="input" maxLength={150} autoFocus value={productName} onChange={(event) => setProductName(event.target.value)} />
          )}
        </Field>
        <Field label="¿Cuándo suele estar disponible?" error={errors.availableWhen}>
          {(props) => (
            <input
              {...props}
              className="input"
              maxLength={200}
              placeholder="Ej. fines de semana, antes de las 11"
              value={availableWhen}
              onChange={(event) => setAvailableWhen(event.target.value)}
            />
          )}
        </Field>
        <label className={`feature ${sellsOutFast ? 'is-selected' : ''}`}>
          <input type="checkbox" checked={sellsOutFast} onChange={(event) => setSellsOutFast(event.target.checked)} />
          <span>⏳ Se termina rápido</span>
        </label>
        <Field label="Descripción o nota" error={errors.note}>
          {(props) => (
            <textarea {...props} className="input" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>
        <FormActions saving={saving} label="Guardar" error={errors.form} onClose={onClose} />
      </form>
    </Modal>
  );
}

export function SeasonalForm({
  establishmentId,
  item,
  onClose,
  onSaved,
}: {
  establishmentId: number;
  item?: SeasonalProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [triedOn, setTriedOn] = useState(item?.triedOn ?? todayLocal());
  const [note, setNote] = useState(item?.note ?? '');
  const [status, setStatus] = useState<SeasonalProduct['status'] | ''>(item?.status ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const shownPhoto = preview ?? (removePhoto ? null : (item?.photoThumbUrl ?? null));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    if (!name.trim()) found.name = 'Escribe el nombre del producto.';
    if (!triedOn) found.triedOn = 'Indica cuándo lo probaste.';
    else if (triedOn > todayLocal()) found.triedOn = 'La fecha no puede estar en el futuro.';
    if (!status) found.status = 'Indica si sigue disponible o fue temporal.';
    if (Object.keys(found).length > 0 || !status) {
      setErrors(found);
      return;
    }
    setSaving(true);
    const input = { name, triedOn, note, status, photo, removePhoto };
    try {
      if (item) await api.updateSeasonal(item.id, input);
      else await api.createSeasonal(establishmentId, input);
      onSaved();
    } catch (error) {
      setErrors(readErrors(error));
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? 'Editar producto de temporada' : 'Agregar producto de temporada'} onClose={onClose}>
      <form className="review-form" onSubmit={submit} noValidate>
        <Field label="Nombre del producto" required error={errors.name}>
          {(props) => <input {...props} className="input" maxLength={150} autoFocus value={name} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Field label="Fecha en la que lo probé" required error={errors.triedOn}>
          {(props) => (
            <input {...props} className="input" type="date" max={todayLocal()} value={triedOn} onChange={(event) => setTriedOn(event.target.value)} />
          )}
        </Field>
        <ChoiceGroup
          legend="¿Sigue disponible?"
          name="estado-temporada"
          value={status}
          error={errors.status}
          onChange={setStatus}
          options={[
            { value: 'disponible', label: 'Todavía disponible' },
            { value: 'temporal', label: 'Fue temporal' },
          ]}
        />
        <Field label="Descripción o nota personal" error={errors.note}>
          {(props) => <textarea {...props} className="input" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />}
        </Field>
        <Field label="Fotografía (opcional)">
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
            <img src={shownPhoto} alt="Fotografía del producto" />
            {!photo && (
              <button type="button" className="link-btn" onClick={() => setRemovePhoto(true)}>
                Quitar fotografía
              </button>
            )}
          </div>
        )}
        <FormActions saving={saving} label="Guardar" error={errors.form} onClose={onClose} />
      </form>
    </Modal>
  );
}
