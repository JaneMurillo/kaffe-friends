import { ArrowDownWideNarrow, ArrowUpNarrowWide, MapPin, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PlaceImage } from '../components/ui/PlaceImage';
import { ScoreBadge } from '../components/ui/ScoreBadge';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import { aspectsFor } from '../components/forms/Questionnaire';
import type { Category, RankingEntry } from '../types';
import { CATEGORIES, CATEGORY_LABELS, TYPE_LABELS, formatScore, offersCategory, placeArea } from '../utils/format';

function CategoryScores({ entry }: { entry: RankingEntry }) {
  const scoreOf = (category: Category) => entry.place.ratings[category]?.score ?? null;
  const { detailScores } = entry.place;
  const aspects = aspectsFor(entry.place);
  if (aspects.some((aspect) => detailScores[aspect.key] !== null)) {
    return (
      <dl className="category-scores">
        {aspects.map((aspect) => (
          <div key={aspect.key} className="category-scores__item">
            <dt>{aspect.label}</dt>
            <dd>{detailScores[aspect.key] ?? '—'}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className="category-scores">
      {CATEGORIES.filter((category) => offersCategory(entry.place, category)).map((category) => {
        const score = scoreOf(category);
        return (
          <div key={category} className="category-scores__item">
            <dt>{CATEGORY_LABELS[category]}</dt>
            <dd>{score === null ? '—' : formatScore(score)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function RankingRow({ entry, label }: { entry: RankingEntry; label: string }) {
  return (
    <li className={`ranking__item ${entry.position === 1 ? 'is-first' : ''}`}>
      <span className="ranking__position" aria-label={`Posición ${entry.position}`}>
        {entry.position}
      </span>
      <div className="ranking__media">
        <PlaceImage photo={entry.place.mainPhoto} name={entry.place.name} type={entry.place.type} />
      </div>
      <div className="ranking__main">
        <p className="card__type">{TYPE_LABELS[entry.place.type]}</p>
        <h2 className="ranking__name">
          <Link to={`/lugar/${entry.place.id}`} className="card__link">
            {entry.place.name}
          </Link>
        </h2>
        <p className="card__place">
          <MapPin aria-hidden size={15} /> {placeArea(entry.place)}
        </p>
        <CategoryScores entry={entry} />
      </div>
      <ScoreBadge score={entry.score} size="large" label={label} />
    </li>
  );
}

export function TopPage() {
  useDocumentTitle('Top cafeterías');
  const [params, setParams] = useSearchParams();
  const community = params.get('ranking') === 'comunitario';
  const dir = params.get('orden') === 'asc' ? 'asc' : 'desc';

  const { data: entries, error, reload } = useAsync(
    () => api.ranking(community ? 'community' : 'personal', dir),
    [community, dir],
  );

  const update = (key: string, value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <>
      <PageHeader
        kicker="El ranking"
        title={community ? 'Ranking comunitario' : 'Top cafeterías'}
        intro={
          community
            ? 'Promedia mi calificación y la de cada amigo, con el mismo peso por persona. Es independiente de mi Top.'
            : 'Se calcula exclusivamente con mis calificaciones personales. Las opiniones de mis amigos no lo modifican.'
        }
      >
        <div className="ranking-controls">
          <div className="segmented" role="group" aria-label="Tipo de ranking">
            <button type="button" aria-pressed={!community} onClick={() => update('ranking', null)}>
              Mi Top
            </button>
            <button type="button" aria-pressed={community} onClick={() => update('ranking', 'comunitario')}>
              Comunitario
            </button>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => update('orden', dir === 'desc' ? 'asc' : null)}>
            {dir === 'desc' ? <ArrowDownWideNarrow aria-hidden size={17} /> : <ArrowUpNarrowWide aria-hidden size={17} />}
            {dir === 'desc' ? 'De mayor a menor' : 'De menor a mayor'}
          </button>
        </div>
      </PageHeader>

      <section className="container section--flush">
        {error && <ErrorState error={error} onRetry={reload} />}
        {!error && !entries && <PageLoader />}
        {entries?.length === 0 && (
          <EmptyState
            title="El podio está vacío"
            message="En cuanto califiques un lugar aparecerá aquí, sin que tengas que hacer nada más."
            action={
              <Link to="/todas" className="btn btn--primary">
                <Plus aria-hidden size={18} /> Calificar un lugar
              </Link>
            }
          />
        )}
        {entries && entries.length > 0 && (
          <ol className="ranking">
            {entries.map((entry) => (
              <RankingRow
                key={entry.place.id}
                entry={entry}
                label={community ? 'Calificación comunitaria' : 'Mi calificación'}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
