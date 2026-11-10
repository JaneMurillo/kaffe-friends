import { LayoutGrid, List, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../services/api';
import { plural } from '../../utils/format';
import { CardsSkeleton, EmptyState, ErrorState } from '../ui/States';
import { EstablishmentCard, EstablishmentRow } from './EstablishmentCard';

/** Filtros fijos de una sección; el usuario no puede quitarlos. */
export interface SectionScope {
  type?: 'cafeteria' | 'panaderia';
}

const SORTS = [
  { value: 'recent-desc', label: 'Agregados recientemente' },
  { value: 'name-asc', label: 'Nombre (A–Z)' },
  { value: 'name-desc', label: 'Nombre (Z–A)' },
  { value: 'visitDate-desc', label: 'Visita más reciente' },
  { value: 'visitDate-asc', label: 'Visita más antigua' },
  { value: 'score-desc', label: 'Mejor calificados' },
  { value: 'score-asc', label: 'Menor calificación' },
];

/** Extras que se pueden marcar varios a la vez; se muestran los lugares que cumplen con todos. */
const EXTRAS = [
  { key: 'boardGames', label: '🎲 Con juegos de mesa' },
  { key: 'sugarFree', label: '🥤 Con bebidas sin azúcar' },
  { key: 'seasonalDrinks', label: '🍂 Con bebidas de temporada' },
] as const;

const FILTER_KEYS = ['q', 'type', 'score', 'passport', 'food', 'desserts', ...EXTRAS.map((extra) => extra.key)];

type ViewMode = 'cards' | 'list';
const VIEW_KEY = 'kaffe:vista';

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

export function EstablishmentBrowser({ scope = {} }: { scope?: SectionScope }) {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>(readView);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(params.get('q') ?? '');

  const setParam = (key: string, value: string) => {
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

  // La búsqueda espera a que se deje de escribir para no pedir datos en cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (params.get('q') ?? '')) setParam('q', search);
    }, 250);
    return () => window.clearTimeout(timer);
    // Solo debe reaccionar al texto escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const sortValue = params.get('sort') ?? 'recent-desc';
  const score = params.get('score') ?? '';
  const query = useMemo(() => {
    const [sort, dir] = sortValue.split('-');
    return {
      q: params.get('q') ?? undefined,
      type: scope.type ?? params.get('type') ?? undefined,
      food: params.get('food') ?? undefined,
      minScore: score && score !== 'sin' ? score : undefined,
      unrated: score === 'sin' ? 'true' : undefined,
      passport: params.get('passport') ?? undefined,
      desserts: params.get('desserts') ?? undefined,
      ...Object.fromEntries(EXTRAS.map(({ key }) => [key, params.get(key) === 'true' ? 'true' : undefined])),
      sort,
      dir,
    };
  }, [params, scope.type, score, sortValue]);

  const { data: places, error, loading, reload } = useAsync(() => api.establishments(query), [JSON.stringify(query)]);

  const activeFilters = FILTER_KEYS.filter((key) =>
    EXTRAS.some((extra) => extra.key === key) ? params.get(key) === 'true' : Boolean(params.get(key)),
  ).length;

  const changeView = (mode: ViewMode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* Sin almacenamiento, la preferencia dura solo esta visita. */
    }
  };

  const clearFilters = () => {
    setSearch('');
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of FILTER_KEYS) next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <section className="browser container" aria-label="Cafeterías y panaderías">
      <div className="browser__toolbar">
        <div className="search">
          <Search aria-hidden size={18} className="search__icon" />
          <input
            type="search"
            className="input search__input"
            placeholder="Buscar por nombre…"
            aria-label="Buscar por nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn--ghost browser__filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="filtros"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden size={17} />
          Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>
        <label className="browser__sort">
          <span className="visually-hidden">Ordenar por</span>
          <select className="input" value={sortValue} onChange={(event) => setParam('sort', event.target.value)}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="view-toggle" role="group" aria-label="Vista">
          <button type="button" className="icon-btn" aria-label="Vista de tarjetas" aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
            <LayoutGrid aria-hidden size={19} />
          </button>
          <button type="button" className="icon-btn" aria-label="Vista de lista" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
            <List aria-hidden size={19} />
          </button>
        </div>
      </div>

      <div id="filtros" className={`filters ${filtersOpen ? 'is-open' : ''}`}>
        {!scope.type && (
          <label className="filter">
            <span className="filter__label">Categoría</span>
            <select className="input" value={params.get('type') ?? ''} onChange={(event) => setParam('type', event.target.value)}>
              <option value="">Todas</option>
              <option value="cafeteria">Cafeterías</option>
              <option value="panaderia">Panaderías</option>
            </select>
          </label>
        )}
        <label className="filter">
          <span className="filter__label">Calificación</span>
          <select className="input" value={score} onChange={(event) => setParam('score', event.target.value)}>
            <option value="">Cualquiera</option>
            <option value="9">9 o más</option>
            <option value="8">8 o más</option>
            <option value="7">7 o más</option>
            <option value="6">6 o más</option>
            <option value="sin">Sin calificar</option>
          </select>
        </label>
        <label className="filter">
          <span className="filter__label">Pasaporte</span>
          <select className="input" value={params.get('passport') ?? ''} onChange={(event) => setParam('passport', event.target.value)}>
            <option value="">Todos</option>
            <option value="true">Participa</option>
            <option value="false">No participa</option>
          </select>
        </label>
        <label className="filter">
          <span className="filter__label">Comida</span>
          <select className="input" value={params.get('food') ?? ''} onChange={(event) => setParam('food', event.target.value)}>
            <option value="">Indistinto</option>
            <option value="true">Con comida</option>
            <option value="false">Sin comida</option>
          </select>
        </label>
        <label className="filter">
          <span className="filter__label">Postres</span>
          <select className="input" value={params.get('desserts') ?? ''} onChange={(event) => setParam('desserts', event.target.value)}>
            <option value="">Indistinto</option>
            <option value="true">Con postres</option>
            <option value="false">Sin postres</option>
          </select>
        </label>
        <fieldset className="filter filter--extras">
          <legend className="filter__label">Extras</legend>
          <div className="features__options">
            {EXTRAS.map(({ key, label }) => {
              const checked = params.get(key) === 'true';
              return (
                <label key={key} className={`feature ${checked ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={(event) => setParam(key, event.target.checked ? 'true' : '')} />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="browser__summary" aria-live="polite">
        <span>{places ? plural(places.length, 'lugar', 'lugares') : ' '}</span>
        {activeFilters > 0 && (
          <button type="button" className="link-btn" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {!error && loading && !places && <CardsSkeleton />}
      {!error && places?.length === 0 &&
        (activeFilters > 0 ? (
          <EmptyState
            title="Nada con esos filtros"
            message="Prueba quitando alguno: quizá tu próximo café esté a un clic."
            action={
              <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                Limpiar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            title="Esta mesa sigue libre"
            message="Todavía no hay lugares registrados en esta sección. Agrega el primero."
            action={
              <Link to="/agregar" className="btn btn--primary">
                <Plus aria-hidden size={18} /> Agregar cafetería
              </Link>
            }
          />
        ))}
      {!error && places && places.length > 0 && (
        <div className={`${view === 'cards' ? 'card-grid' : 'row-list'} ${loading ? 'is-refreshing' : ''}`}>
          {places.map((place) =>
            view === 'cards' ? <EstablishmentCard key={place.id} place={place} /> : <EstablishmentRow key={place.id} place={place} />,
          )}
        </div>
      )}
    </section>
  );
}
