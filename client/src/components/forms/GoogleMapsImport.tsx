import { CheckCircle2, Link2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ApiError, api } from '../../services/api';
import type { ResolvedPlace } from '../../types';
import { Field } from '../ui/Field';

const FIELD_LABELS: [keyof ResolvedPlace, string][] = [
  ['name', 'nombre'],
  ['address', 'dirección'],
  ['neighborhood', 'colonia'],
  ['latitude', 'ubicación en el mapa'],
];

/** Pega un enlace de Google Maps y completa el formulario solo con lo que realmente se obtuvo. */
export function GoogleMapsImport({
  initialUrl,
  onResolved,
  onUrlChange,
}: {
  initialUrl: string;
  onResolved: (place: ResolvedPlace) => void;
  onUrlChange: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResolvedPlace | null>(null);

  const resolve = async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const place = await api.resolveGoogleMapsLink(value);
      setResult(place);
      onResolved(place);
    } catch (reason) {
      const fields = reason instanceof ApiError ? reason.fields : {};
      setError(fields.url ?? (reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filled = result ? FIELD_LABELS.filter(([key]) => result[key] !== null).map(([, label]) => label) : [];

  return (
    <div className="maps-import">
      <div className="maps-import__row">
        <Field
          label="Enlace de Google Maps"
          hint="Pégalo y completaremos lo que se pueda. Siempre podrás corregirlo."
          error={error}
        >
          {(props) => (
            <input
              {...props}
              className="input"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://maps.app.goo.gl/…"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                onUrlChange(event.target.value);
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text').trim();
                if (!pasted) return;
                event.preventDefault();
                setUrl(pasted);
                onUrlChange(pasted);
                void resolve(pasted);
              }}
            />
          )}
        </Field>
        <button type="button" className="btn btn--ghost" disabled={loading || !url.trim()} onClick={() => resolve(url)}>
          <Link2 aria-hidden size={17} /> {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {result && (
        <div className="maps-import__result" role="status">
          {filled.length > 0 ? (
            <p className="maps-import__ok">
              <CheckCircle2 aria-hidden size={17} /> Se completó: {filled.join(', ')}. Revisa que sea correcto.
            </p>
          ) : (
            <p className="maps-import__warn">
              <TriangleAlert aria-hidden size={17} /> No se obtuvieron datos del enlace, pero quedará guardado en la ficha.
            </p>
          )}
          {result.warnings.map((warning) => (
            <p key={warning} className="maps-import__warn">
              <TriangleAlert aria-hidden size={17} /> {warning}
            </p>
          ))}
          {result.source === 'places' && <p className="maps-import__credit">Datos de Google Maps</p>}
          {!result.apiConfigured && (
            <p className="maps-import__credit">
              Para completar dirección y ubicación automáticamente, abre configurar-google.bat en tu computadora.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
