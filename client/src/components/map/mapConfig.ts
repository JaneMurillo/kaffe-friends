import L from 'leaflet';
import type { EstablishmentType } from '../../types';

/** Vista inicial del mapa: el centro de la ciudad. No representa a ningún lugar. */
export const GUADALAJARA_CENTER: [number, number] = [20.6736, -103.344];
export const CITY_ZOOM = 12;

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">Colaboradores de OpenStreetMap</a>';

/** Marcador propio por tipo. Evita además el problema de rutas del ícono por defecto de Leaflet. */
export function placeIcon(type: EstablishmentType): L.DivIcon {
  return L.divIcon({
    className: `pin pin--${type}`,
    html: '<span class="pin__dot"></span>',
    iconSize: [30, 38],
    iconAnchor: [15, 37],
    popupAnchor: [0, -34],
  });
}
