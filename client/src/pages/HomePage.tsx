import { ArrowRight, Map, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EstablishmentCard } from '../components/establishments/EstablishmentCard';
import { CupIllustration } from '../components/ui/Illustrations';
import { PlaceImage } from '../components/ui/PlaceImage';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import { TYPE_LABELS, formatScore, placeArea } from '../utils/format';

export function HomePage() {
  useDocumentTitle(undefined);
  const { data: stats, error, reload } = useAsync(() => api.stats(), []);

  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!stats) return <PageLoader />;

  // Portada: la mejor calificada con foto, o la más reciente con foto. Nunca una imagen ajena.
  const featured =
    stats.top.find((entry) => entry.place.mainPhoto)?.place ?? stats.latest.find((place) => place.mainPhoto) ?? null;

  return (
    <>
      <section className="hero container">
        <div className="hero__copy">
          <p className="kicker">Guadalajara, Jalisco</p>
          <h1 className="hero__title">
            Los Amigos <span className="hero__title-line">del Kaffe</span>
          </h1>
          <p className="hero__slogan">Un café a la vez.</p>
          <p className="hero__text">
            Una guía personal para descubrir, evaluar y recordar los mejores lugares de café y panadería de la ciudad:
            lo que probamos, lo que nos encantó y a dónde vamos a volver.
          </p>
          <div className="hero__actions">
            <Link to="/agregar" className="btn btn--primary btn--large">
              <Plus aria-hidden size={18} /> Agregar cafetería
            </Link>
            <Link to="/mapa" className="btn btn--ghost btn--large">
              <Map aria-hidden size={18} /> Ver el mapa
            </Link>
          </div>
        </div>
        <figure className="hero__figure">
          {featured ? (
            <>
              <PlaceImage photo={featured.mainPhoto} name={featured.name} type={featured.type} size="full" className="hero__image" priority />
              <figcaption className="hero__caption">
                <Link to={`/lugar/${featured.id}`}>{featured.name}</Link> · {placeArea(featured)}
              </figcaption>
            </>
          ) : (
            <div className="hero__placeholder">
              <CupIllustration className="hero__placeholder-art" />
              <p>Aquí aparecerá la fotografía de tu lugar favorito.</p>
            </div>
          )}
        </figure>
      </section>

      <section className="ledger container" aria-label="La guía en números">
        <dl className="ledger__list">
          <div className="ledger__item">
            <dt>Cafeterías totales</dt>
            <dd>{stats.cafeterias}</dd>
          </div>
          <div className="ledger__item">
            <dt>Panaderías totales</dt>
            <dd>{stats.panaderias}</dd>
          </div>
          <div className="ledger__item">
            <dt>Total General</dt>
            <dd>{stats.total}</dd>
          </div>
          <div className="ledger__item">
            <dt>Mi promedio general</dt>
            <dd>{stats.averagePersonal === null ? '—' : formatScore(stats.averagePersonal)}</dd>
          </div>
        </dl>
      </section>

      {stats.total === 0 ? (
        <section className="container section">
          <EmptyState
            title="La primera taza está por servirse"
            message="Tu guía está lista. Registra el primer lugar y empieza a llenarla, un café a la vez."
            action={
              <Link to="/agregar" className="btn btn--primary">
                <Plus aria-hidden size={18} /> Agregar cafetería
              </Link>
            }
          />
        </section>
      ) : (
        <>
          <section className="section container">
            <div className="section__head">
              <div>
                <p className="kicker">Recién llegados</p>
                <h2 className="section__title">Últimos agregados</h2>
              </div>
              <Link to="/todas" className="section__more">
                Ver todos <ArrowRight aria-hidden size={16} />
              </Link>
            </div>
            <div className="card-grid card-grid--four">
              {stats.latest.map((place) => (
                <EstablishmentCard key={place.id} place={place} />
              ))}
            </div>
          </section>

          {stats.top.length > 0 && (
            <section className="section section--tinted">
              <div className="container">
                <div className="section__head">
                  <div>
                    <p className="kicker">Mis favoritas</p>
                    <h2 className="section__title">Mejor calificadas</h2>
                  </div>
                  <Link to="/top" className="section__more">
                    Ver el ranking <ArrowRight aria-hidden size={16} />
                  </Link>
                </div>
                <ol className="top-list">
                  {stats.top.map((entry) => (
                    <li key={entry.place.id} className="top-list__item">
                      <span className="top-list__position" aria-label={`Posición ${entry.position}`}>
                        {entry.position}
                      </span>
                      <div className="top-list__media">
                        <PlaceImage photo={entry.place.mainPhoto} name={entry.place.name} type={entry.place.type} />
                      </div>
                      <div className="top-list__main">
                        <Link to={`/lugar/${entry.place.id}`} className="top-list__name">
                          {entry.place.name}
                        </Link>
                        <p className="top-list__meta">
                          {TYPE_LABELS[entry.place.type]} · {placeArea(entry.place)}
                        </p>
                      </div>
                      <ScoreBadge score={entry.score} label="Mi calificación" />
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </>
      )}

      <section className="map-band">
        <div className="container map-band__inner">
          <div>
            <p className="kicker kicker--light">Mapa cafetero</p>
            <h2 className="map-band__title">Encuentra tu próximo café, colonia por colonia.</h2>
          </div>
          <Link to="/mapa" className="btn btn--cream btn--large">
            <Map aria-hidden size={18} /> Abrir el mapa
          </Link>
        </div>
      </section>
    </>
  );
}
