import { describe, expect, it } from 'vitest';
import { distanceMeters, isGoogleMapsUrl, parseGoogleMapsUrl } from '../src/services/googleMapsLink.js';

describe('lectura de enlaces de Google Maps', () => {
  it('lee nombre y coordenadas exactas de un enlace completo', () => {
    const link = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Caf%C3%A9+de+la+Esquina/@20.67,-103.37,17z/data=!4m6!3m5!8m2!3d20.6736!4d-103.3612',
    );
    expect(link).toMatchObject({ name: 'Café de la Esquina', latitude: 20.6736, longitude: -103.3612 });
    expect(link.viewport).toEqual({ latitude: 20.67, longitude: -103.37 });
  });

  it('nunca toma el centro de la cámara como ubicación del lugar', () => {
    const link = parseGoogleMapsUrl('https://www.google.com/maps/place/Caf%C3%A9/@20.67,-103.37,17z');
    expect(link.latitude).toBeNull();
    expect(link.longitude).toBeNull();
    expect(link.viewport).not.toBeNull();
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@20.67,-103.37,15z').latitude).toBeNull();
  });

  it('lee q= con nombre y dirección, sin inventar la dirección cuando no viene', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=Caf%C3%A9+Sol,+Av.+Uno+1,+Americana,+Guadalajara')).toMatchObject({
      name: 'Café Sol',
      address: 'Av. Uno 1, Americana, Guadalajara',
    });
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=Caf%C3%A9+Sol')).toMatchObject({ name: 'Café Sol', address: null });
  });

  it('lee coordenadas e identificador del formato oficial de URL', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=20.67,-103.36')).toMatchObject({
      name: null,
      latitude: 20.67,
      longitude: -103.36,
    });
    expect(
      parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=Caf%C3%A9&query_place_id=ChIJabc-123').placeId,
    ).toBe('ChIJabc-123');
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=place_id:ChIJxyz').placeId).toBe('ChIJxyz');
  });

  it('ignora coordenadas fuera de rango', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=120.5,-103.3').latitude).toBeNull();
    expect(parseGoogleMapsUrl('https://www.google.com/maps/place/x/data=!3d95.1!4d-103.3').latitude).toBeNull();
  });

  it('solo acepta https en dominios de Google Maps', () => {
    for (const url of [
      'https://maps.app.goo.gl/abc',
      'https://share.google/abc',
      'https://goo.gl/maps/abc',
      'https://www.google.com/maps/place/x',
      'https://www.google.com.mx/maps/place/x',
      'https://maps.google.com/?q=x',
    ]) {
      expect(isGoogleMapsUrl(url), url).toBe(true);
    }
    for (const url of [
      'http://maps.app.goo.gl/abc',
      'https://goo.gl/abc',
      'https://google.evil.com/maps',
      'https://www.google.com@evil.com/maps',
      'https://www.google.com:8443/maps',
      'https://www.google.com/gmail',
      'file:///c:/windows',
    ]) {
      expect(isGoogleMapsUrl(url), url).toBe(false);
    }
  });

  it('calcula distancias', () => {
    expect(distanceMeters({ latitude: 20.67, longitude: -103.36 }, { latitude: 20.67, longitude: -103.36 })).toBe(0);
    const meters = distanceMeters({ latitude: 20.67, longitude: -103.36 }, { latitude: 20.68, longitude: -103.36 });
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
  });
});
