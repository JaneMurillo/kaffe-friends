import { config } from '../config.js';
import { HttpError } from '../errors.js';
import {
  distanceMeters,
  isGoogleMapsUrl,
  isGoogleResultUrl,
  isShortLink,
  parseGoogleMapsUrl,
} from './googleMapsLink.js';

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
/** Más lejos que esto, el resultado de Places no es el lugar que señala el enlace. */
const MAX_MATCH_METERS = 500;
/** Sin coordenadas en el enlace, se prefieren resultados de la ciudad de la guía. */
const GUADALAJARA = { center: { latitude: 20.6736, longitude: -103.344 }, radius: 30000 };
const PLACE_FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsUri', 'addressComponents'];

interface PlacesPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
}

export interface ResolvedPlace {
  name: string | null;
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  googlePlaceId: string | null;
  source: 'places' | 'link';
  apiConfigured: boolean;
  warnings: string[];
}

/** Sigue el enlace corto salto por salto: cada destino se valida antes de abrirlo. */
async function expandLink(value: string): Promise<string> {
  let current = new URL(value);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isShortLink(current)) return current.toString();
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (LosAmigosDelKaffe)' },
    });
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) break;
    let next = new URL(location, current);
    // Google puede pasar por su pantalla de consentimiento con el destino real como parámetro.
    if (next.hostname === 'consent.google.com') next = new URL(next.searchParams.get('continue') ?? '');
    if (next.protocol !== 'https:' || !(isShortLink(next) || isGoogleResultUrl(next))) break;
    current = next;
  }
  throw new Error('El enlace no llevó a un lugar de Google Maps.');
}

async function callPlaces(url: string, init: RequestInit, fieldMask: string[]): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googleMapsApiKey,
      'X-Goog-FieldMask': fieldMask.join(','),
    },
  });
  if (!response.ok) {
    // Queda en la ventana de la aplicación para poder diagnosticar. La clave no se incluye.
    const detail = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    console.warn(`Places API respondió ${response.status}: ${detail?.error?.message ?? 'sin detalle'}`);
    throw new Error(String(response.status));
  }
  return response.json();
}

function placeDetails(placeId: string): Promise<PlacesPlace> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es&regionCode=MX`;
  return callPlaces(url, { method: 'GET' }, PLACE_FIELDS) as Promise<PlacesPlace>;
}

async function searchPlace(
  query: string,
  near: { latitude: number; longitude: number } | null,
): Promise<PlacesPlace | null> {
  const body = {
    textQuery: query,
    languageCode: 'es',
    regionCode: 'MX',
    pageSize: 1,
    locationBias: { circle: near ? { center: near, radius: MAX_MATCH_METERS } : GUADALAJARA },
  };
  const result = (await callPlaces(
    'https://places.googleapis.com/v1/places:searchText',
    { method: 'POST', body: JSON.stringify(body) },
    PLACE_FIELDS.map((field) => `places.${field}`),
  )) as { places?: PlacesPlace[] };
  return result.places?.[0] ?? null;
}

const neighborhoodOf = (place: PlacesPlace): string | null => {
  for (const type of ['neighborhood', 'sublocality_level_1', 'sublocality']) {
    const match = place.addressComponents?.find((component) => component.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return null;
};

const coordinatesOf = (place: PlacesPlace | null) =>
  typeof place?.location?.latitude === 'number' && typeof place.location.longitude === 'number'
    ? { latitude: place.location.latitude, longitude: place.location.longitude }
    : null;

export async function resolveGoogleMapsLink(rawUrl: string): Promise<ResolvedPlace> {
  const pasted = rawUrl.trim();
  if (!isGoogleMapsUrl(pasted)) {
    throw new HttpError(400, 'Revisa los datos marcados.', {
      url: 'Pega un enlace de Google Maps (https://maps.app.goo.gl/… o https://www.google.com/maps/…).',
    });
  }

  let finalUrl: string;
  try {
    finalUrl = await expandLink(pasted);
  } catch {
    throw new HttpError(502, 'No se pudo abrir el enlace. Revisa tu conexión a internet o llena los datos a mano.');
  }

  const link = parseGoogleMapsUrl(finalUrl);
  const warnings: string[] = [];
  const apiConfigured = config.googleMapsApiKey !== '';
  const exact =
    link.latitude !== null && link.longitude !== null ? { latitude: link.latitude, longitude: link.longitude } : null;
  let place: PlacesPlace | null = null;

  if (apiConfigured && (link.placeId || link.query)) {
    try {
      place = link.placeId ? await placeDetails(link.placeId) : await searchPlace(link.query!, exact ?? link.viewport);
      const found = coordinatesOf(place);
      if (place && exact && found && distanceMeters(exact, found) > MAX_MATCH_METERS) {
        place = null;
        warnings.push('Google Places devolvió otro lugar, lejos del punto del enlace, así que se descartó ese resultado.');
      } else if (place && !exact && !link.placeId) {
        warnings.push('Google Places eligió el resultado más parecido. Confirma que sea la sucursal correcta.');
      }
    } catch {
      warnings.push('No se pudo consultar Google Places. Revisa tu clave de API; se usaron solo los datos del enlace.');
    }
  }

  const name = place?.displayName?.text ?? link.name;
  const address = place?.formattedAddress ?? link.address;
  // Las coordenadas del enlace tienen prioridad: son las del punto que elegiste en Google Maps.
  const coordinates = exact ?? coordinatesOf(place);

  if (!name) warnings.push('El enlace no incluye el nombre del lugar.');
  if (!address) {
    warnings.push(
      apiConfigured ? 'No se encontró la dirección.' : 'El enlace no incluye la dirección.',
    );
  }
  if (!coordinates) warnings.push('El enlace no incluye la ubicación exacta. Márcala en el mapa.');

  return {
    name,
    address,
    neighborhood: place ? neighborhoodOf(place) : null,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    googleMapsUrl: pasted,
    googlePlaceId: place?.id ?? link.placeId,
    source: place ? 'places' : 'link',
    apiConfigured,
    warnings,
  };
}
