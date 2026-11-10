import { MapPin, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { useFeedback } from '../components/ui/Feedback';
import { Field } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { PassportStamp } from '../components/ui/PassportStamp';
import { PlaceImage } from '../components/ui/PlaceImage';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import type { Establishment } from '../types';
import { formatDate, todayLocal, placeArea } from '../utils/format';

const TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'visitados', label: 'Visitados' },
  { value: 'pendientes', label: 'Pendientes' },
] as const;

function VisitDialog({
  place,
  onClose,
  onSaved,
}: {
  place: Establishment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!date) {
      setError('Indica la fecha de visita.');
      return;
    }
    if (date > todayLocal()) {
      setError('La fecha no puede estar en el futuro.');
      return;
    }
    setSaving(true);
    try {
      await api.updateVisit(place.id, 'visitado', date);
      toast(`¡Sello para ${place.name}!`);
      onSaved();
    } catch (reason) {
      setError((reason as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Sellar ${place.name}`} onClose={onClose} size="small">
      <form onSubmit={submit} noValidate>
        <Field label="Fecha de visita" required error={error}>
          {(props) => (
            <input {...props} type="date" className="input" max={todayLocal()} value={date} onChange={(event) => setDate(event.target.value)} />
          )}
        </Field>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            Marcar como visitado
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PassportPage() {
  useDocumentTitle('Pasaporte Guadalajara');
  const { toast } = useFeedback();
  const [params, setParams] = useSearchParams();
  const [sealing, setSealing] = useState<Establishment | null>(null);
  const { data, error, reload } = useAsync(() => api.passport(), []);
  const tab = params.get('estado') ?? 'todos';

  const markPending = async (place: Establishment) => {
    try {
      await api.updateVisit(place.id, 'pendiente', null);
      toast(`${place.name} volvió a pendientes.`);
      reload();
    } catch (reason) {
      toast((reason as Error).message, 'error');
    }
  };

  const shown =
    data?.places.filter((place) => {
      if (tab === 'visitados') return place.visitStatus === 'visitado';
      if (tab === 'pendientes') return place.visitStatus === 'pendiente';
      return true;
    }) ?? [];

  return (
    <>
      <PageHeader
        kicker="Edición especial"
        title="Pasaporte Guadalajara"
        intro="Los lugares registrados como parte del pasaporte. Cada visita es un sello más."
      />
      <section className="container section--flush">
        {error && <ErrorState error={error} onRetry={reload} />}
        {!error && !data && <PageLoader />}
        {data && (
          <>
            <div className="passport-summary">
              <div className="passport-summary__progress">
                <p className="passport-summary__percent">{data.percent}%</p>
                <p className="passport-summary__caption">de avance</p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.percent}
                  aria-label="Avance del pasaporte"
                >
                  <div className="progress__bar" style={{ width: `${data.percent}%` }} />
                </div>
              </div>
              <dl className="passport-summary__counts">
                <div>
                  <dt>Registrados</dt>
                  <dd>{data.total}</dd>
                </div>
                <div>
                  <dt>Visitados</dt>
                  <dd>{data.visited}</dd>
                </div>
                <div>
                  <dt>Pendientes</dt>
                  <dd>{data.pending}</dd>
                </div>
              </dl>
            </div>

            <div className="segmented passport-tabs" role="group" aria-label="Filtrar por estado">
              {TABS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={tab === item.value}
                  onClick={() => setParams(item.value === 'todos' ? {} : { estado: item.value }, { replace: true })}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {shown.length === 0 &&
              (data.total === 0 ? (
                <EmptyState
                  title="Tu pasaporte está en blanco"
                  message='Al registrar un lugar, responde "Sí" a "¿Pertenece al Pasaporte Guadalajara?" y aparecerá aquí.'
                  action={
                    <Link to="/agregar" className="btn btn--primary">
                      <Plus aria-hidden size={18} /> Agregar cafetería
                    </Link>
                  }
                />
              ) : (
                <EmptyState title="Nada por aquí" message="No hay lugares con este estado." />
              ))}

            <ul className="passport-grid">
              {shown.map((place) => (
                <li key={place.id} className={`passport-card passport-card--${place.visitStatus}`}>
                  <div className="passport-card__media">
                    <PlaceImage photo={place.mainPhoto} name={place.name} type={place.type} />
                  </div>
                  <PassportStamp status={place.visitStatus} className="passport-card__stamp" />
                  <div className="passport-card__body">
                    <h2 className="passport-card__name">
                      <Link to={`/lugar/${place.id}`}>{place.name}</Link>
                    </h2>
                    <p className="card__place">
                      <MapPin aria-hidden size={15} /> {[place.address, place.neighborhood].filter(Boolean).join(', ') || placeArea(place)}
                    </p>
                    <p className="passport-card__date">
                      {place.visitDate ? `Visitado el ${formatDate(place.visitDate)}` : 'Por visitar'}
                    </p>
                    <div className="passport-card__footer">
                      <ScoreBadge score={place.scores.personal} size="small" label="Mi calificación" emptyLabel="s/c" />
                      {place.visitStatus === 'pendiente' ? (
                        <button type="button" className="btn btn--small btn--primary" onClick={() => setSealing(place)}>
                          Marcar visitado
                        </button>
                      ) : (
                        <button type="button" className="btn btn--small btn--ghost" onClick={() => markPending(place)}>
                          Volver a pendiente
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {sealing && (
        <VisitDialog
          place={sealing}
          onClose={() => setSealing(null)}
          onSaved={() => {
            setSealing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
