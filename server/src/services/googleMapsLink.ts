/**
 * Lectura de enlaces de Google Maps. Son funciones puras: solo extraen lo que el enlace dice.
 * Las coordenadas de "@lat,lng" son el centro de la cámara del mapa, no la posición del lugar,
 * así que nunca se devuelven como ubicación: solo orientan la búsqueda en Places API.
 */
export interface ParsedLink {
  name: string | null;
  address: string | null;
  query: string | null;
  latitude: number | null;
  longitude: number | null;
  viewport: { latitude: number; longitude: number } | null;
  placeId: string | null;
}

const GOOGLE_HOST = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/;

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

export function isShortLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || host === 'share.google') return true;
  if (host === 'goo.gl' && url.pathname.startsWith('/maps')) return true;
  // share.google redirige primero a esta dirección intermedia y de ahí al resultado.
  return GOOGLE_HOST.test(host) && url.pathname === '/share.google';
}

export function isGoogleResultUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (!GOOGLE_HOST.test(host)) return false;
  return host.startsWith('maps.') || url.pathname.startsWith('/maps') || url.pathname === '/search';
}

/** Solo https y solo dominios de Google: el servidor nunca abre otra dirección. */
export function isGoogleMapsUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  return isShortLink(url) || isGoogleResultUrl(url);
}

const validPair = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

function coordinatesIn(text: string | null): [number, number] | null {
  const match = text?.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*\+?(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const pair: [number, number] = [Number(match[1]), Number(match[2])];
  return validPair(...pair) ? pair : null;
}

const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' ')).trim();
  } catch {
    return segment.replace(/\+/g, ' ').trim();
  }
};

export function parseGoogleMapsUrl(value: string): ParsedLink {
  const result: ParsedLink = {
    name: null,
    address: null,
    query: null,
    latitude: null,
    longitude: null,
    viewport: null,
    placeId: null,
  };
  const url = parseUrl(value);
  if (!url) return result;

  const setExact = (pair: [number, number] | null) => {
    if (pair && result.latitude === null) [result.latitude, result.longitude] = pair;
  };

  // "!3d…!4d…" es la posición del lugar. Si hay varias, la última corresponde al seleccionado.
  const pins = [...value.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  const lastPin = pins[pins.length - 1];
  if (lastPin && validPair(Number(lastPin[1]), Number(lastPin[2]))) setExact([Number(lastPin[1]), Number(lastPin[2])]);

  const camera = url.pathname.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (camera && validPair(Number(camera[1]), Number(camera[2]))) {
    result.viewport = { latitude: Number(camera[1]), longitude: Number(camera[2]) };
  }

  const named = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/);
  const segment = named?.[1] && !named[1].startsWith('@') ? decodeSegment(named[1]) : null;
  const params = url.searchParams;
  const text = segment ?? params.get('q') ?? params.get('query') ?? params.get('destination');

  result.placeId = params.get('query_place_id') ?? params.get('destination_place_id') ?? params.get('place_id');
  setExact(coordinatesIn(params.get('ll')));

  if (text?.startsWith('place_id:')) {
    result.placeId = text.slice('place_id:'.length);
  } else if (text) {
    const pair = coordinatesIn(text);
    if (pair) {
      setExact(pair);
    } else {
      // "Nombre, calle, colonia, ciudad": el resto solo se toma como dirección si es lo bastante largo.
      const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
      result.query = text;
      result.name = parts[0] ?? null;
      if (parts.length >= 3) result.address = parts.slice(1).join(', ');
    }
  }
  if (result.placeId && !/^[\w-]{1,300}$/.test(result.placeId)) result.placeId = null;
  return result;
}

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
