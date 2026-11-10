import { lazy, Suspense, useEffect, useState } from 'react';
import { Field } from '../ui/Field';
import { PageLoader } from '../ui/States';

const LocationMap = lazy(() => import('../map/PlaceMap').then((module) => ({ default: module.LocationMap })));

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
  latitudeError?: string;
  longitudeError?: string;
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;
const toText = (value: number | null) => (value === null ? '' : String(value));

/** Reconoce el formato que copia Google Maps u OpenStreetMap: "20.6736, -103.344". */
function parsePair(text: string): [number, number] | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** La ubicación nunca se inventa: viene del enlace de Google Maps, se escribe a mano o se elige en el mapa. */
export function LocationPicker({ latitude, longitude, onChange, latitudeError, longitudeError }: LocationPickerProps) {
  const [latText, setLatText] = useState(toText(latitude));
  const [lngText, setLngText] = useState(toText(longitude));

  // Cuando el valor llega desde el mapa, los campos de texto lo reflejan.
  useEffect(() => setLatText(toText(latitude)), [latitude]);
  useEffect(() => setLngText(toText(longitude)), [longitude]);

  const commit = (latValue: string, lngValue: string) => {
    const parse = (text: string) => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text));
    onChange(parse(latValue), parse(lngValue));
  };

  const hasPoint = latitude !== null && longitude !== null;

  return (
    <div className="location">
      <p className="form-section__help">
        Haz clic en el mapa para colocar el marcador y arrástralo para afinarlo. También puedes pegar las coordenadas
        que copies de un mapa.
      </p>
      <Suspense fallback={<PageLoader />}>
        <LocationMap
          value={hasPoint ? [latitude, longitude] : null}
          onPick={(lat, lng) => onChange(round(lat), round(lng))}
        />
      </Suspense>
      <div className="form-grid form-grid--coords">
        <Field label="Latitud" error={latitudeError}>
          {(props) => (
            <input
              {...props}
              className="input"
              inputMode="decimal"
              placeholder="Ej. 20.6736"
              value={latText}
              onChange={(event) => {
                setLatText(event.target.value);
                commit(event.target.value, lngText);
              }}
              onPaste={(event) => {
                const pair = parsePair(event.clipboardData.getData('text'));
                if (pair) {
                  event.preventDefault();
                  onChange(pair[0], pair[1]);
                }
              }}
            />
          )}
        </Field>
        <Field label="Longitud" error={longitudeError}>
          {(props) => (
            <input
              {...props}
              className="input"
              inputMode="decimal"
              placeholder="Ej. -103.3440"
              value={lngText}
              onChange={(event) => {
                setLngText(event.target.value);
                commit(latText, event.target.value);
              }}
            />
          )}
        </Field>
        <button
          type="button"
          className="btn btn--ghost location__clear"
          disabled={!latText && !lngText}
          onClick={() => {
            setLatText('');
            setLngText('');
            onChange(null, null);
          }}
        >
          Quitar ubicación
        </button>
      </div>
    </div>
  );
}
