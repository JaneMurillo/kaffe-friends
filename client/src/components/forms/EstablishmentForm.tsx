import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { ApiError, api } from '../../services/api';
import type { Answers, Consumed, DetailScores, EstablishmentDetail, EstablishmentInput, Photo, ResolvedPlace } from '../../types';
import { CATEGORIES, CATEGORY_LABELS, EMPTY_CONSUMED, TYPE_NOUNS, todayLocal } from '../../utils/format';
import { EMPTY_ANSWERS } from '../../utils/questionnaire';
import { useFeedback } from '../ui/Feedback';
import { ChoiceGroup, Field } from '../ui/Field';
import { GoogleMapsImport } from './GoogleMapsImport';
import { LocationPicker } from './LocationPicker';
import { PhotoManager } from './PhotoManager';
import { PhotoPicker } from './PhotoPicker';
import { AspectScores, ConsumedInputs, EMPTY_SCORES, Questionnaire } from './Questionnaire';

type Errors = Record<string, string>;
type Values = Omit<EstablishmentInput, 'answers' | 'scores' | 'consumed'>;

const STEPS = [
  { id: 'lugar', label: 'El lugar' },
  { id: 'opinion', label: 'Mi opinión' },
  { id: 'calificaciones', label: 'Calificaciones' },
  { id: 'mapa', label: 'Ubicación' },
  { id: 'fotos', label: 'Fotografías' },
] as const;

/** Paso donde vive cada campo, para llevarte directo al que tiene un error. */
const STEP_OF_FIELD: Record<string, number> = { scores: 2, latitude: 3, longitude: 3, answers: 1, observations: 1 };

function initialValues(place?: EstablishmentDetail): Values {
  return {
    name: place?.name ?? '',
    type: place?.type ?? 'cafeteria',
    address: place?.address ?? '',
    neighborhood: place?.neighborhood ?? '',
    latitude: place?.latitude ?? null,
    longitude: place?.longitude ?? null,
    visitStatus: place?.visitStatus ?? 'visitado',
    visitDate: place?.visitDate ?? null,
    description: place?.description ?? '',
    observations: place?.observations ?? '',
    inPassport: place?.inPassport ?? false,
    offersDrinks: place?.offersDrinks ?? true,
    offersFood: place?.offersFood ?? false,
    offersDesserts: place?.offersDesserts ?? false,
    offersSugarFree: place?.offersSugarFree ?? false,
    offersBoardGames: place?.offersBoardGames ?? false,
    offersSeasonalDrinks: place?.offersSeasonalDrinks ?? false,
    googleMapsUrl: place?.googleMapsUrl ?? null,
    googlePlaceId: place?.googlePlaceId ?? null,
  };
}

/** Validación inmediata en el navegador. El servidor repite estas reglas y es la autoridad. */
function validate(values: Values): Errors {
  const errors: Errors = {};
  const noun = values.type ? TYPE_NOUNS[values.type] : 'cafetería';
  if (!values.name.trim()) errors.name = `Escribe el nombre de la ${noun}. Con eso ya puedes guardar y seguir después.`;
  if (values.visitDate && values.visitDate > todayLocal()) errors.visitDate = 'La fecha no puede estar en el futuro.';
  if ((values.latitude === null) !== (values.longitude === null)) {
    errors.latitude = 'Indica latitud y longitud juntas, o deja ambas vacías.';
  }
  return errors;
}

function stepWithError(errors: Errors): number {
  const steps = Object.keys(errors).map((key) => STEP_OF_FIELD[key.split('.')[0]!] ?? 0);
  return steps.length ? Math.min(...steps) : 0;
}

function Feature({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={`feature ${checked ? 'is-selected' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function EstablishmentForm({ place }: { place?: EstablishmentDetail }) {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(() => initialValues(place));
  const [answers, setAnswers] = useState<Answers>(place?.answers ?? EMPTY_ANSWERS);
  const [scores, setScores] = useState<DetailScores>(place?.detailScores ?? EMPTY_SCORES);
  const [consumed, setConsumed] = useState<Consumed>(place?.consumed ?? EMPTY_CONSUMED);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>(place?.photos ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newMainIndex, setNewMainIndex] = useState(0);
  const errorSummary = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const { data: neighborhoods } = useAsync(() => api.neighborhoods(), []);

  const noun = values.type ? TYPE_NOUNS[values.type] : 'cafetería';
  const isPending = values.visitStatus === 'pendiente';
  const isLast = step === STEPS.length - 1;

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!(key in current)) return current;
      const { [key]: _removed, ...rest } = current;
      return rest;
    });

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    clearError(key);
  };

  const goTo = (next: number) => {
    setStep(next);
    top.current?.scrollIntoView({ block: 'start' });
  };

  /** Solo llena lo que se obtuvo: lo que no vino se queda como estaba, nunca se inventa. */
  const applyGooglePlace = (found: ResolvedPlace) => {
    setValues((current) => ({
      ...current,
      name: found.name ?? current.name,
      address: found.address ?? current.address,
      neighborhood: found.neighborhood ?? current.neighborhood,
      latitude: found.latitude ?? current.latitude,
      longitude: found.longitude ?? current.longitude,
      googleMapsUrl: found.googleMapsUrl,
      googlePlaceId: found.googlePlaceId,
    }));
    setErrors({});
  };

  const showErrors = (found: Errors) => {
    setErrors(found);
    setStep(stepWithError(found));
    requestAnimationFrame(() => errorSummary.current?.focus());
  };

  // Calificaciones guardadas que se perderán: se avisa antes y se conservan si cambia de idea.
  const legacyToLose = place ? CATEGORIES.filter((category) => place.ratings[category]) : [];
  const willLoseScores =
    Boolean(place) && isPending && (legacyToLose.length > 0 || Object.values(place!.detailScores).some((score) => score !== null));

  const save = async () => {
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    const payload: EstablishmentInput = {
      ...values,
      visitDate: isPending ? null : values.visitDate,
      answers,
      consumed,
      scores: isPending ? EMPTY_SCORES : scores,
    };

    setSaving(true);
    setErrors({});
    let saved: EstablishmentDetail;
    try {
      saved = place ? await api.updateEstablishment(place.id, payload) : await api.createEstablishment(payload);
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) showErrors(error.fields);
      else toast((error as Error).message, 'error');
      return;
    }

    if (newFiles.length > 0) {
      try {
        // Al crear, la elegida es principal; al editar, solo se cambia desde la galería.
        await api.addPhotos(saved.id, newFiles, savedPhotos.length === 0 ? newMainIndex : null);
      } catch (error) {
        // Se queda en edición con las fotos seleccionadas, para corregirlas sin duplicar el lugar.
        toast(`Se guardó, pero no las fotografías: ${(error as Error).message}`, 'error');
        setSaving(false);
        if (!place) navigate(`/lugar/${saved.id}/editar`, { replace: true });
        return;
      }
    }
    toast(place ? 'Cambios guardados.' : `¡${saved.name} ya está en tu guía!`);
    navigate(`/lugar/${saved.id}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isLast) void save();
    else goTo(step + 1);
  };

  const errorList = Object.values(errors);

  return (
    <form className="place-form container" onSubmit={submit} noValidate>
      <div ref={top} className="stepper-anchor" />
      <nav aria-label="Pasos del formulario">
        <ol className="stepper">
          {STEPS.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={`stepper__step ${index === step ? 'is-current' : ''}`}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => goTo(index)}
              >
                <span className="stepper__number">{index + 1}</span>
                <span className="stepper__label">{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {errorList.length > 0 && (
        <div className="form-errors" role="alert" tabIndex={-1} ref={errorSummary}>
          <p className="form-errors__title">Antes de guardar, revisa lo siguiente:</p>
          <ul>
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {step === 0 && (
        <section className="form-section">
          <GoogleMapsImport
            initialUrl={values.googleMapsUrl ?? ''}
            onResolved={applyGooglePlace}
            onUrlChange={(url) => {
              setValues((current) => ({ ...current, googleMapsUrl: url.trim() || null, googlePlaceId: null }));
              clearError('googleMapsUrl');
            }}
          />
          {errors.googleMapsUrl && <p className="field__error">{errors.googleMapsUrl}</p>}

          <div className="form-grid">
            <Field label={`Nombre de la ${noun}`} required error={errors.name}>
              {(props) => (
                <input {...props} className="input" maxLength={200} value={values.name} onChange={(event) => set('name', event.target.value)} />
              )}
            </Field>
            <ChoiceGroup
              legend="Categoría"
              name="tipo"
              value={values.type}
              error={errors.type}
              onChange={(type) => set('type', type)}
              options={[
                { value: 'cafeteria', label: 'Cafetería' },
                { value: 'panaderia', label: 'Panadería' },
              ]}
            />
            <Field label="Dirección" error={errors.address}>
              {(props) => (
                <input {...props} className="input" maxLength={300} value={values.address} onChange={(event) => set('address', event.target.value)} />
              )}
            </Field>
            <Field label="Colonia" error={errors.neighborhood}>
              {(props) => (
                <>
                  <input
                    {...props}
                    className="input"
                    list="colonias"
                    maxLength={120}
                    value={values.neighborhood}
                    onChange={(event) => set('neighborhood', event.target.value)}
                  />
                  <datalist id="colonias">
                    {neighborhoods?.map((neighborhood) => <option key={neighborhood} value={neighborhood} />)}
                  </datalist>
                </>
              )}
            </Field>
          </div>

          <Field label="Descripción breve" error={errors.description}>
            {(props) => (
              <textarea
                {...props}
                className="input"
                rows={2}
                maxLength={4000}
                placeholder="En una línea, ¿qué lo hace especial?"
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </Field>

          <fieldset className="features">
            <legend className="field__label">¿Qué más ofrece?</legend>
            <div className="features__options">
              <Feature label="🍽️ Comida" checked={values.offersFood} onChange={(value) => set('offersFood', value)} />
              <Feature label="🍰 Postres" checked={values.offersDesserts} onChange={(value) => set('offersDesserts', value)} />
              <Feature label="🥤 Bebidas sin azúcar" checked={values.offersSugarFree} onChange={(value) => set('offersSugarFree', value)} />
              <Feature label="🍂 Bebidas de temporada" checked={values.offersSeasonalDrinks} onChange={(value) => set('offersSeasonalDrinks', value)} />
              <Feature label="🎲 Juegos de mesa" checked={values.offersBoardGames} onChange={(value) => set('offersBoardGames', value)} />
              <Feature label="🛂 Pasaporte Guadalajara" checked={values.inPassport} onChange={(value) => set('inPassport', value)} />
            </div>
          </fieldset>

          <div className="form-grid">
            <ChoiceGroup
              legend="Visita"
              name="estado-visita"
              value={values.visitStatus}
              onChange={(status) => set('visitStatus', status)}
              options={[
                { value: 'visitado', label: 'Ya fui' },
                { value: 'pendiente', label: 'Pendiente' },
              ]}
            />
            {!isPending && (
              <Field label="Fecha de visita" error={errors.visitDate}>
                {(props) => (
                  <input
                    {...props}
                    className="input"
                    type="date"
                    max={todayLocal()}
                    value={values.visitDate ?? ''}
                    onChange={(event) => set('visitDate', event.target.value || null)}
                  />
                )}
              </Field>
            )}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="form-section">
          <div>
            <h2 className="form-section__title">Mi opinión</h2>
            <p className="form-section__help">Unos toques y listo. Responde solo lo que quieras.</p>
          </div>
          {isPending ? (
            <p className="form-section__help">Cuando vayas, marca la visita como “Ya fui” para responder.</p>
          ) : (
            <>
              <ConsumedInputs consumed={consumed} offers={values} onChange={setConsumed} />
              <Questionnaire answers={answers} onChange={setAnswers} name="mi-opinion" />
            </>
          )}
          <Field label="Observaciones personales" hint="Opcional. Lo que quieras recordar.">
            {(props) => (
              <textarea
                {...props}
                className="input"
                rows={3}
                maxLength={4000}
                value={values.observations}
                onChange={(event) => set('observations', event.target.value)}
              />
            )}
          </Field>
        </section>
      )}

      {step === 2 && (
        <section className="form-section">
          <h2 className="form-section__title">Calificaciones</h2>
          {willLoseScores && (
            <p className="form-warning" role="status">
              Al guardar como pendiente se eliminarán las calificaciones de este lugar
              {legacyToLose.length > 0 && <> (también las anteriores de {legacyToLose.map((category) => CATEGORY_LABELS[category].toLowerCase()).join(', ')})</>}.
            </p>
          )}
          {isPending ? (
            <p className="form-section__help">Podrás calificar este lugar cuando lo visites.</p>
          ) : (
            <AspectScores scores={scores} offers={values} onChange={setScores} errors={errors} name="calificacion" />
          )}
        </section>
      )}

      {step === 3 && (
        <section className="form-section">
          <h2 className="form-section__title">Ubicación</h2>
          <LocationPicker
            latitude={values.latitude}
            longitude={values.longitude}
            latitudeError={errors.latitude}
            longitudeError={errors.longitude}
            onChange={(latitude, longitude) => {
              setValues((current) => ({ ...current, latitude, longitude }));
              clearError('latitude');
              clearError('longitude');
            }}
          />
        </section>
      )}

      {step === 4 && (
        <section className="form-section">
          <h2 className="form-section__title">Fotografías</h2>
          {savedPhotos.length > 0 && place && <PhotoManager photos={savedPhotos} name={place.name} onChange={setSavedPhotos} />}
          <PhotoPicker
            files={newFiles}
            mainIndex={newMainIndex}
            allowMain={savedPhotos.length === 0}
            onChange={(files, mainIndex) => {
              setNewFiles(files);
              setNewMainIndex(mainIndex);
            }}
          />
        </section>
      )}

      <div className="form-actions">
        <Link to={place ? `/lugar/${place.id}` : '/todas'} className="btn btn--ghost form-actions__cancel">
          Cancelar
        </Link>
        {step > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => goTo(step - 1)}>
            Anterior
          </button>
        )}
        {!isLast && (
          <button type="button" className="btn btn--ghost form-actions__save" disabled={saving} onClick={() => void save()}>
            {saving ? 'Guardando…' : place ? 'Guardar' : 'Guardar y seguir después'}
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {isLast ? (saving ? 'Guardando…' : place ? 'Guardar cambios' : `Guardar ${noun}`) : 'Siguiente'}
        </button>
      </div>
    </form>
  );
}
