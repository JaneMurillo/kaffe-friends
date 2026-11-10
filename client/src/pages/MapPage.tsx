import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PlaceMap } from '../components/map/PlaceMap';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import { plural } from '../utils/format';

export function MapPage() {
  useDocumentTitle('Mapa cafetero');
  const [params, setParams] = useSearchParams();
  const score = params.get('score') ?? '';

  const query = useMemo(
    () => ({
      type: params.get('type') ?? undefined,
      minScore: score || undefined,
      passport: params.get('passport') ?? undefined,
    }),
    [params, score],
  );

  const { data: places, error, reload } = useAsync(() => api.establishments(query), [JSON.stringify(query)]);

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const withoutLocation = places?.filter((place) => place.latitude === null) ?? [];
  const locatedCount = (places?.length ?? 0) - withoutLocation.length;

  return (
    <>
      <PageHeader
        kicker="Guadalajara"
        title="Mapa cafetero"
        intro="Todos los lugares que tienen ubicación registrada. Selecciona un marcador para ver su ficha."
      />
      <section className="container section--flush">
        <div className="filters filters--map is-open">
          <label className="filter">
            <span className="filter__label">Tipo</span>
            <select className="input" value={params.get('type') ?? ''} onChange={(event) => setParam('type', event.target.value)}>
              <option value="">Todos</option>
              <option value="cafeteria">Cafeterías</option>
              <option value="panaderia">Panaderías</option>
            </select>
          </label>
          <label className="filter">
            <span className="filter__label">Calificación</span>
            <select className="input" value={score} onChange={(event) => setParam('score', event.target.value)}>
              <option value="">Cualquiera</option>
              <option value="9">9 o más</option>
              <option value="8">8 o más</option>
              <option value="7">7 o más</option>
              <option value="6">6 o más</option>
            </select>
          </label>
          <label className="filter">
            <span className="filter__label">Pasaporte Guadalajara</span>
            <select className="input" value={params.get('passport') ?? ''} onChange={(event) => setParam('passport', event.target.value)}>
              <option value="">Todos</option>
              <option value="true">Participantes</option>
            </select>
          </label>
        </div>

        {error && <ErrorState error={error} onRetry={reload} />}
        {!error && !places && <PageLoader />}
        {places && (
          <>
            <div className="map-meta">
              <p aria-live="polite">{plural(locatedCount, 'lugar en el mapa', 'lugares en el mapa')}</p>
              <ul className="map-legend" aria-label="Leyenda">
                <li>
                  <span className="map-legend__dot map-legend__dot--cafeteria" /> Cafetería
                </li>
                <li>
                  <span className="map-legend__dot map-legend__dot--panaderia" /> Panadería
                </li>
              </ul>
            </div>
            <PlaceMap places={places} className="map--page" />
            {withoutLocation.length > 0 && (
              <div className="map-missing">
                <p className="map-missing__title">
                  {plural(withoutLocation.length, 'lugar todavía no tiene', 'lugares todavía no tienen')} ubicación:
                </p>
                <ul>
                  {withoutLocation.map((place) => (
                    <li key={place.id}>
                      <Link to={`/lugar/${place.id}/editar`}>{place.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
