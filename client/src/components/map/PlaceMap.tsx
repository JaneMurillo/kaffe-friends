import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import type { Establishment } from '../../types';
import { TYPE_LABELS } from '../../utils/format';
import { PlaceImage } from '../ui/PlaceImage';
import { ScoreBadge } from '../ui/ScoreBadge';
import { CITY_ZOOM, GUADALAJARA_CENTER, TILE_ATTRIBUTION, TILE_URL, placeIcon } from './mapConfig';

/** Ajusta la vista a los marcadores cada vez que cambia el conjunto visible. */
function FitToPlaces({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length === 0) {
      map.setView(GUADALAJARA_CENTER, CITY_ZOOM);
    } else if (points.length === 1) {
      map.setView(points[0]!, 16);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Tile layer que avisa si no se pueden descargar los mosaicos (por ejemplo, sin internet). */
export function BaseTiles({ onTileError }: { onTileError?: () => void }) {
  return (
    <TileLayer
      url={TILE_URL}
      attribution={TILE_ATTRIBUTION}
      maxZoom={19}
      eventHandlers={onTileError ? { tileerror: onTileError } : undefined}
    />
  );
}

export function TilesNotice() {
  return (
    <p className="map-notice" role="status">
      No se pudieron cargar los mosaicos del mapa. Revisa tu conexión a internet: tus datos siguen a salvo en tu
      computadora.
    </p>
  );
}

export function PlaceMap({ places, className = '' }: { places: Establishment[]; className?: string }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const located = places.filter((place) => place.latitude !== null && place.longitude !== null);
  const points = located.map((place): [number, number] => [place.latitude!, place.longitude!]);

  return (
    <div className={`map ${className}`}>
      <MapContainer center={GUADALAJARA_CENTER} zoom={CITY_ZOOM} className="map__canvas" scrollWheelZoom>
        <BaseTiles onTileError={() => setTilesFailed(true)} />
        <FitToPlaces points={points} />
        {located.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude!, place.longitude!]}
            icon={placeIcon(place.type)}
            title={place.name}
            alt={place.name}
          >
            <Popup minWidth={240} maxWidth={260}>
              <div className="map-popup">
                <div className="map-popup__media">
                  <PlaceImage photo={place.mainPhoto} name={place.name} type={place.type} />
                </div>
                <div className="map-popup__head">
                  <div>
                    <p className="map-popup__type">{TYPE_LABELS[place.type]}</p>
                    <p className="map-popup__name">{place.name}</p>
                  </div>
                  <ScoreBadge score={place.scores.personal} size="small" label="Mi calificación" emptyLabel="s/c" />
                </div>
                <p className="map-popup__address">{place.address}</p>
                <Link to={`/lugar/${place.id}`} className="map-popup__link">
                  Ver perfil completo
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tilesFailed && <TilesNotice />}
    </div>
  );
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

/** Mantiene el mapa centrado cuando las coordenadas se escriben a mano. */
function FollowValue({ value }: { value: [number, number] | null }) {
  const map = useMap();
  const key = value?.join(',');
  useEffect(() => {
    if (value && !map.getBounds().contains(value)) map.setView(value, Math.max(map.getZoom(), 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export function LocationMap({
  value,
  onPick,
}: {
  value: [number, number] | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const [tilesFailed, setTilesFailed] = useState(false);
  return (
    <div className="map map--picker">
      <MapContainer center={value ?? GUADALAJARA_CENTER} zoom={value ? 16 : CITY_ZOOM} className="map__canvas">
        <BaseTiles onTileError={() => setTilesFailed(true)} />
        <ClickToPlace onPick={onPick} />
        <FollowValue value={value} />
        {value && (
          <Marker
            position={value}
            icon={placeIcon('cafeteria')}
            draggable
            title="Ubicación seleccionada"
            alt="Ubicación seleccionada"
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as L.Marker).getLatLng();
                onPick(lat, lng);
              },
            }}
          />
        )}
      </MapContainer>
      {tilesFailed && <TilesNotice />}
    </div>
  );
}
