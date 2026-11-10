import { CalendarDays, Clock, ExternalLink, ImagePlus, MapPin, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlaceTags } from '../components/establishments/EstablishmentCard';
import { AvailabilityForm, NotesForm, SeasonalForm } from '../components/forms/ExtrasForms';
import { PhotoManager } from '../components/forms/PhotoManager';
import { aspectsFor } from '../components/forms/Questionnaire';
import { ReviewForm } from '../components/forms/ReviewForm';
import { PlaceMap } from '../components/map/PlaceMap';
import { ReviewCard } from '../components/reviews/ReviewCard';
import { AnswerSummary, AnswerTags } from '../components/ui/AnswerTags';
import { useFeedback } from '../components/ui/Feedback';
import { Lightbox } from '../components/ui/Lightbox';
import { PassportStamp } from '../components/ui/PassportStamp';
import { PlaceImage } from '../components/ui/PlaceImage';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiError, api } from '../services/api';
import type {
  AvailabilityItem,
  EstablishmentDetail,
  Photo,
  PhotoCategory,
  Review,
  SeasonalProduct,
} from '../types';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PHOTO_CATEGORIES,
  TYPE_LABELS,
  TYPE_NOUNS,
  consumedFields,
  formatDate,
  formatScore,
  googleMapsLink,
  offersCategory,
  placeArea,
  plural,
} from '../utils/format';
import { hasAnyAnswer } from '../utils/questionnaire';
import { NotFoundPage } from './NotFoundPage';

interface SectionProps {
  place: EstablishmentDetail;
  onChange: () => void;
}

function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="sheet__head">
      <h2 className="sheet__title">{title}</h2>
      {children && <div className="sheet__actions">{children}</div>}
    </header>
  );
}

/** Solo lo anotado y que el lugar ofrece. */
const consumedList = (place: EstablishmentDetail) => consumedFields(place).filter((field) => place.consumed[field.key]);

function missingFields(place: EstablishmentDetail): string[] {
  const missing: string[] = [];
  if (!place.address) missing.push('dirección');
  if (place.latitude === null) missing.push('ubicación en el mapa');
  if (place.photos.length === 0) missing.push('fotografías');
  if (place.visitStatus === 'visitado') {
    if (!hasAnyAnswer(place.answers) && !place.observations && consumedList(place).length === 0) missing.push('tu opinión');
    if (place.scores.personal === null) missing.push('calificaciones');
  }
  return missing;
}

function Hero({ place, onRemove }: { place: EstablishmentDetail; onRemove: () => void }) {
  const area = [place.address, place.neighborhood].filter(Boolean).join(', ');
  const missing = missingFields(place);
  return (
    <header className="sheet-hero container">
      <div className="sheet-hero__copy">
        <p className="kicker">{TYPE_LABELS[place.type]}</p>
        <h1 className="sheet-hero__title">{place.name}</h1>
        {area && (
          <p className="sheet-hero__meta">
            <MapPin aria-hidden size={17} /> {area}
          </p>
        )}
        <p className="sheet-hero__meta">
          <CalendarDays aria-hidden size={17} />
          {place.visitDate
            ? `Visitado el ${formatDate(place.visitDate)}`
            : place.visitStatus === 'visitado'
              ? 'Ya visitado'
              : 'Pendiente de visita'}
        </p>
        {place.description && <p className="sheet-hero__description">{place.description}</p>}
        <PlaceTags place={place} />
        <AnswerTags answers={place.answers} keys={['ambiente', 'volveria']} label="Etiquetas principales" />
        {missing.length > 0 && (
          <p className="sheet-hero__todo">
            Falta por completar: {missing.join(', ')}. <Link to={`/lugar/${place.id}/editar`}>Continuar</Link>
          </p>
        )}
        <div className="sheet-hero__actions">
          <Link to={`/lugar/${place.id}/editar`} className="btn btn--ghost">
            <Pencil aria-hidden size={16} /> Editar
          </Link>
          <button type="button" className="btn btn--ghost btn--danger-text" onClick={onRemove}>
            <Trash2 aria-hidden size={16} /> Eliminar
          </button>
        </div>
      </div>
      <figure className="sheet-hero__figure">
        <PlaceImage photo={place.mainPhoto} name={place.name} type={place.type} size="full" className="sheet-hero__image" priority />
        {place.inPassport && <PassportStamp status={place.visitStatus} className="sheet-hero__stamp" />}
      </figure>
    </header>
  );
}

function ScoresSection({ place }: { place: EstablishmentDetail }) {
  const { detailScores, scores } = place;
  const aspects = aspectsFor(place);
  const usesLegacy = scores.personal !== null && aspects.every((aspect) => detailScores[aspect.key] === null);
  return (
    <section className="sheet sheet--scores" id="calificaciones">
      <SectionHead title="Calificaciones" />
      <div className="score-board">
        <div className="score-board__general">
          <span className="score-board__value">{scores.personal === null ? '—' : formatScore(scores.personal)}</span>
          <span className="score-board__label">Calificación general</span>
        </div>
        <dl className="score-board__list">
          {aspects.map((aspect) => {
            const value = detailScores[aspect.key];
            return (
              <div key={aspect.key} className="score-line">
                <dt>{aspect.label}</dt>
                <dd>
                  <span className="score-line__track" aria-hidden="true">
                    <span className="score-line__fill" style={{ width: `${(value ?? 0) * 10}%` }} />
                  </span>
                  <span className="score-line__number">{value ?? '—'}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      {usesLegacy && (
        <p className="sheet__note">
          Esta calificación viene de tus notas anteriores por categoría. Cuando califiques alguno de estos aspectos, se
          calculará con ellos.
        </p>
      )}
      {place.visitStatus === 'pendiente' && <p className="sheet__note">Este lugar está pendiente. Califícalo cuando vayas.</p>}
    </section>
  );
}

function PhotosSection({ place, onChange }: SectionProps) {
  const { toast } = useFeedback();
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<PhotoCategory | 'todas'>('todas');
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>('lugar');

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await api.addPhotos(place.id, files, null, uploadCategory);
      toast(files.length === 1 ? 'Fotografía agregada.' : 'Fotografías agregadas.');
      onChange();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const used = PHOTO_CATEGORIES.filter((category) => place.photos.some((photo) => photo.category === category.value));
  const shown: Photo[] = filter === 'todas' ? place.photos : place.photos.filter((photo) => photo.category === filter);

  return (
    <section className="sheet" id="fotografias">
      <SectionHead title="Fotografías">
        <label className="sheet__select">
          <span className="visually-hidden">Categoría de las fotografías nuevas</span>
          <select className="input" value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as PhotoCategory)}>
            {PHOTO_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`btn btn--ghost ${uploading ? 'is-disabled' : ''}`}>
          <ImagePlus aria-hidden size={18} />
          {uploading ? 'Subiendo…' : 'Agregar fotografías'}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff"
            className="visually-hidden"
            disabled={uploading}
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </label>
      </SectionHead>
      {place.photos.length === 0 ? (
        <p className="sheet__empty">Todavía no hay fotografías. Elige de qué son y agrégalas.</p>
      ) : (
        <>
          {used.length > 1 && (
            <div className="segmented segmented--wrap" role="group" aria-label="Filtrar fotografías">
              <button type="button" aria-pressed={filter === 'todas'} onClick={() => setFilter('todas')}>
                Todas
              </button>
              {used.map((category) => (
                <button key={category.value} type="button" aria-pressed={filter === category.value} onClick={() => setFilter(category.value)}>
                  {category.label}
                </button>
              ))}
            </div>
          )}
          <PhotoManager photos={shown} name={place.name} onChange={onChange} showcase />
        </>
      )}
    </section>
  );
}

function NotesSection({ place, onChange }: SectionProps) {
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<'availability' | 'seasonal' | null>(null);
  const consumed = consumedList(place);
  const hasNotes = hasAnyAnswer(place.answers) || Boolean(place.observations) || consumed.length > 0;
  const legacy = CATEGORIES.filter((category) => place.ratings[category] && offersCategory(place, category));

  const saved = (message: string) => {
    setEditing(false);
    setAdding(null);
    toast(message);
    onChange();
  };

  return (
    <section className="sheet sheet--mine" id="mis-notas">
      <SectionHead title="Mis notas">
        <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
          <Pencil aria-hidden size={16} /> {hasNotes ? 'Editar mis notas' : 'Responder cuestionario'}
        </button>
      </SectionHead>

      {hasNotes ? (
        <>
          <AnswerSummary answers={place.answers} />
          {place.observations && (
            <section className="notes-comments">
              <h3 className="answer-summary__title">Mis comentarios</h3>
              <blockquote className="sheet__quote">{place.observations}</blockquote>
            </section>
          )}
          {consumed.length > 0 && (
            <dl className="consumed">
              {consumed.map((field) => (
                <div key={field.key} className="consumed__item">
                  <dt>
                    <span aria-hidden="true">{field.emoji} </span>
                    {field.title}
                  </dt>
                  <dd>{place.consumed[field.key]}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <p className="sheet__empty">Aún no tienes notas. Responde unas preguntas rápidas sobre tu visita.</p>
      )}

      {legacy.length > 0 && (
        <details className="legacy-notes">
          <summary>Calificaciones anteriores por categoría</summary>
          <ul className="legacy-notes__list">
            {legacy.map((category) => {
              const rating = place.ratings[category]!;
              return (
                <li key={category}>
                  <strong>
                    {CATEGORY_LABELS[category]}
                    {rating.score !== null && `: ${rating.score}`}
                  </strong>
                  {rating.highlights && <span> · {rating.highlights}</span>}
                  {rating.comment && <p>{rating.comment}</p>}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <div className="sheet__add-row">
        <button type="button" className="link-btn" onClick={() => setAdding('availability')}>
          <Plus aria-hidden size={15} /> Agregar a Disponibilidad
        </button>
        <button type="button" className="link-btn" onClick={() => setAdding('seasonal')}>
          <Plus aria-hidden size={15} /> Agregar producto de temporada
        </button>
      </div>

      {editing && <NotesForm place={place} onClose={() => setEditing(false)} onSaved={() => saved('Notas guardadas.')} />}
      {adding === 'availability' && (
        <AvailabilityForm establishmentId={place.id} onClose={() => setAdding(null)} onSaved={() => saved('Producto agregado a Disponibilidad.')} />
      )}
      {adding === 'seasonal' && (
        <SeasonalForm establishmentId={place.id} onClose={() => setAdding(null)} onSaved={() => saved('Producto de temporada agregado.')} />
      )}
    </section>
  );
}

function AvailabilitySection({ place, onChange }: SectionProps) {
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState<AvailabilityItem | null>(null);
  if (place.availability.length === 0) return null;

  const remove = async (item: AvailabilityItem) => {
    const accepted = await confirm({
      title: 'Quitar de Disponibilidad',
      message: `Se quitará "${item.productName}" de esta ficha.`,
      confirmLabel: 'Quitar',
    });
    if (!accepted) return;
    try {
      await api.deleteAvailability(item.id);
      onChange();
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  return (
    <section className="sheet" id="disponibilidad">
      <SectionHead title="Disponibilidad" />
      <ul className="availability">
        {place.availability.map((item) => (
          <li key={item.id} className="availability__item">
            <div className="availability__main">
              <h3 className="availability__name">{item.productName}</h3>
              {item.availableWhen && (
                <p className="availability__when">
                  <Clock aria-hidden size={15} /> {item.availableWhen}
                </p>
              )}
              {item.note && <p className="availability__note">{item.note}</p>}
              {item.sellsOutFast && (
                <span className="tag tag--alert">
                  <Timer aria-hidden size={13} /> Se termina rápido
                </span>
              )}
            </div>
            <span className="review__actions">
              <button type="button" className="icon-btn" aria-label={`Editar ${item.productName}`} onClick={() => setEditing(item)}>
                <Pencil aria-hidden size={17} />
              </button>
              <button type="button" className="icon-btn" aria-label={`Quitar ${item.productName}`} onClick={() => remove(item)}>
                <Trash2 aria-hidden size={17} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {editing && (
        <AvailabilityForm
          establishmentId={place.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </section>
  );
}

function SeasonalSection({ place, onChange }: SectionProps) {
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState<SeasonalProduct | null>(null);
  const [zoomed, setZoomed] = useState<SeasonalProduct | null>(null);
  if (place.seasonal.length === 0) return null;

  const remove = async (item: SeasonalProduct) => {
    const accepted = await confirm({
      title: 'Eliminar producto de temporada',
      message: `Se eliminará "${item.name}" y su fotografía. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!accepted) return;
    try {
      await api.deleteSeasonal(item.id);
      onChange();
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  return (
    <section className="sheet" id="temporada">
      <SectionHead title="Productos de temporada" />
      <ul className="seasonal">
        {place.seasonal.map((item) => (
          <li key={item.id} className="seasonal__item">
            {item.photoThumbUrl && (
              <button type="button" className="seasonal__photo" aria-label={`Ampliar la fotografía de ${item.name}`} onClick={() => setZoomed(item)}>
                <img src={item.photoThumbUrl} alt="" loading="lazy" decoding="async" />
              </button>
            )}
            <div className="seasonal__body">
              <h3 className="seasonal__name">{item.name}</h3>
              <p className="seasonal__date">Lo probé el {formatDate(item.triedOn)}</p>
              {item.note && <p className="seasonal__note">{item.note}</p>}
              <div className="seasonal__footer">
                <span className={`tag ${item.status === 'disponible' ? 'tag--available' : ''}`}>
                  {item.status === 'disponible' ? 'Todavía disponible' : 'Fue temporal'}
                </span>
                <span className="review__actions">
                  <button type="button" className="icon-btn" aria-label={`Editar ${item.name}`} onClick={() => setEditing(item)}>
                    <Pencil aria-hidden size={17} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Eliminar ${item.name}`} onClick={() => remove(item)}>
                    <Trash2 aria-hidden size={17} />
                  </button>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <SeasonalForm
          establishmentId={place.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
      {zoomed?.photoUrl && (
        <Lightbox images={[{ url: zoomed.photoUrl, alt: `Fotografía de ${zoomed.name}` }]} startIndex={0} onClose={() => setZoomed(null)} />
      )}
    </section>
  );
}

function ReviewsSection({ place, onChange }: SectionProps) {
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState<Review | 'new' | null>(null);
  const { friends, community, friendCount } = place.scores;

  const remove = async (review: Review) => {
    const accepted = await confirm({
      title: 'Eliminar opinión',
      message: `Se eliminará la opinión de ${review.friendName} sobre este lugar. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar opinión',
    });
    if (!accepted) return;
    try {
      await api.deleteReview(review.id);
      toast('Opinión eliminada.');
      onChange();
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  return (
    <section className="sheet" id="opiniones">
      <SectionHead title="Opiniones de amigos">
        <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
          <Plus aria-hidden size={18} /> Agregar opinión
        </button>
      </SectionHead>
      {friendCount > 0 && (
        <div className="friend-scores">
          <span className="friend-scores__item">
            <ScoreBadge score={friends} size="small" label="Promedio de amigos" emptyLabel="s/c" />
            <span>Promedio de amigos · {plural(friendCount, 'calificación', 'calificaciones')}</span>
          </span>
          <span className="friend-scores__item">
            <ScoreBadge score={community} size="small" label="Calificación comunitaria" emptyLabel="s/c" />
            <span>Comunitaria · cada persona pesa lo mismo</span>
          </span>
        </div>
      )}
      {place.reviews.length === 0 ? (
        <p className="sheet__empty">¿Fuiste con alguien? Registra su opinión en unos toques.</p>
      ) : (
        <div className="review-grid">
          {place.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onEdit={() => setEditing(review)} onDelete={() => remove(review)} />
          ))}
        </div>
      )}
      {editing && (
        <ReviewForm
          establishmentId={place.id}
          review={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </section>
  );
}

function LocationSection({ place }: { place: EstablishmentDetail }) {
  const mapsLink = googleMapsLink(place);
  return (
    <section className="sheet" id="ubicacion">
      <SectionHead title="Ubicación">
        {mapsLink && (
          <a className="btn btn--ghost" href={mapsLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden size={16} /> Abrir en Google Maps
          </a>
        )}
      </SectionHead>
      {place.latitude !== null ? (
        <PlaceMap places={[place]} className="map--detail" />
      ) : (
        <p className="sheet__empty">
          Todavía sin ubicación en el mapa. <Link to={`/lugar/${place.id}/editar`}>Agrégala editando este lugar.</Link>
        </p>
      )}
    </section>
  );
}

function PlaceContent({ id }: { id: number }) {
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const { data: place, error, reload } = useAsync(() => api.establishment(id), [id]);
  useDocumentTitle(place?.name);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!place) return <PageLoader />;

  const remove = async () => {
    const accepted = await confirm({
      title: `Eliminar ${place.name}`,
      message:
        'Se borrarán sus calificaciones, notas, opiniones de amigos, productos y fotografías. Esta acción no se puede deshacer.',
      confirmLabel: `Eliminar ${TYPE_NOUNS[place.type]}`,
    });
    if (!accepted) return;
    try {
      await api.deleteEstablishment(place.id);
      toast(`${place.name} se eliminó de tu guía.`);
      navigate('/todas');
    } catch (reason) {
      toast((reason as Error).message, 'error');
    }
  };

  return (
    <article className="place" aria-label={`${place.name}, ${placeArea(place)}`}>
      <Hero place={place} onRemove={remove} />
      <div className="container sheet-body">
        <ScoresSection place={place} />
        <PhotosSection place={place} onChange={reload} />
        <NotesSection place={place} onChange={reload} />
        <AvailabilitySection place={place} onChange={reload} />
        <SeasonalSection place={place} onChange={reload} />
        <ReviewsSection place={place} onChange={reload} />
        <LocationSection place={place} />
      </div>
    </article>
  );
}

export function PlacePage() {
  const { id } = useParams();
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return <NotFoundPage />;
  return <PlaceContent id={numericId} />;
}
