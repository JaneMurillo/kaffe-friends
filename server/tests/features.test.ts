import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaffe-features-'));
process.env.DATA_DIR = dataDir;
process.env.APP_PASSWORD = '';
process.env.GOOGLE_MAPS_API_KEY = 'clave-de-prueba';

let app: Express;
let closeDatabase: () => void;

const base = { type: 'cafeteria', visitStatus: 'visitado' };
const jpg = () => sharp({ create: { width: 800, height: 600, channels: 3, background: '#76513d' } }).jpeg().toBuffer();

async function create(overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/establishments').send({ ...base, name: 'Café de prueba', ...overrides });
  expect(res.status).toBe(201);
  return res.body;
}

beforeAll(async () => {
  app = (await import('../src/app.js')).createApp();
  const connection = await import('../src/db/connection.js');
  closeDatabase = connection.closeDatabase;
  connection.openDatabase();
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

afterEach(() => vi.unstubAllGlobals());

describe('guardado parcial y características', () => {
  it('guarda solo con nombre y categoría, sin inventar el resto', async () => {
    const place = await create({ name: 'Solo el nombre' });
    expect(place).toMatchObject({ address: '', neighborhood: '', latitude: null, visitDate: null, offersSugarFree: false });
    expect(place.scores.personal).toBeNull();
  });

  it('comida, postres y bebidas sin azúcar son independientes y filtrables', async () => {
    const place = await create({ name: 'Sin azúcar', offersSugarFree: true });
    expect(place).toMatchObject({ offersSugarFree: true, offersFood: false, offersDesserts: false });
    const { body } = await request(app).get('/api/establishments?sugarFree=true');
    expect(body.map((item: { id: number }) => item.id)).toEqual([place.id]);
  });

  it('juegos de mesa, sin azúcar y bebidas de temporada se combinan al filtrar', async () => {
    const games = await create({ name: 'Juegos', offersBoardGames: true });
    const both = await create({ name: 'Juegos y temporada', offersBoardGames: true, offersSeasonalDrinks: true });
    expect(games).toMatchObject({ offersBoardGames: true, offersSeasonalDrinks: false, offersSugarFree: false });
    const ids = async (query: string) =>
      (await request(app).get(`/api/establishments?${query}`)).body.map((item: { id: number }) => item.id).sort();
    expect(await ids('boardGames=true')).toEqual([games.id, both.id].sort());
    expect(await ids('boardGames=true&seasonalDrinks=true')).toEqual([both.id]);
    expect(await ids('boardGames=true&seasonalDrinks=true&sugarFree=true')).toEqual([]);
  });

  it('las colonias vacías no aparecen como opción de filtro', async () => {
    await create();
    const { body } = await request(app).get('/api/establishments/neighborhoods');
    expect(body).not.toContain('');
  });
});

describe('calificaciones y notas', () => {
  it('la calificación general promedia los aspectos calificados', async () => {
    const place = await create({ scores: { cafe: 9, ambiente: 8, precios: null, atencion: 10 } });
    expect(place.scores.personal).toBe(9);
    expect(place.detailScores).toEqual({ cafe: 9, bebidas: null, comida: null, ambiente: 8, precios: null, atencion: 10 });
  });

  it('bebidas y comida cuentan en el promedio; la comida, solo si el lugar la ofrece', async () => {
    const withFood = await create({ offersFood: true, scores: { cafe: 10, bebidas: 8, comida: 6 } });
    expect(withFood.detailScores).toMatchObject({ bebidas: 8, comida: 6 });
    expect(withFood.scores.personal).toBe(8);

    const noFood = await create({ offersFood: false, scores: { cafe: 10, bebidas: 8, comida: 2 } });
    expect(noFood.scores.personal).toBe(9);
    // Se conserva guardada: vuelve a contar si se marca Comida otra vez.
    expect(noFood.detailScores.comida).toBe(2);
  });

  it('un lugar pendiente no acepta calificaciones de bebidas ni comida', async () => {
    const { status, body } = await request(app)
      .post('/api/establishments')
      .send({ name: 'Pendiente nuevo', type: 'cafeteria', visitStatus: 'pendiente', scores: { bebidas: 8 } });
    expect(status).toBe(400);
    expect(JSON.stringify(body)).toContain('scores.bebidas');
  });

  it('acepta "No lo probé" y ya no acepta postres de temporada ni bebidas especiales', async () => {
    const place = await create();
    const ok = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ answers: { cafe: 'no_probe' } });
    expect(ok.status).toBe(200);
    expect(ok.body.answers.cafe).toBe('no_probe');
    for (const removed of ['postres_temporada', 'especiales']) {
      const res = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ answers: { productos: [removed] } });
      expect(res.status).toBe(400);
    }
  });

  it('las calificaciones anteriores siguen contando hasta que se califica un aspecto', async () => {
    const place = await create({ ratings: { bebidas: { score: 6, comment: 'Rico', highlights: 'Latte' } } });
    expect(place.scores.personal).toBe(6);

    const { body } = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ scores: { cafe: 10 } });
    expect(body.scores.personal).toBe(10);
    // No se pierden: siguen disponibles para consultarlas.
    expect(body.ratings.bebidas).toMatchObject({ score: 6, comment: 'Rico', highlights: 'Latte' });
  });

  it('editar la ficha sin enviar calificaciones anteriores las conserva', async () => {
    const place = await create({ ratings: { bebidas: { score: 7 } } });
    const { body } = await request(app).put(`/api/establishments/${place.id}`).send({ ...base, name: 'Otro nombre' });
    expect(body.ratings.bebidas.score).toBe(7);
  });

  it('guarda el cuestionario, permite varias opciones donde aplica y quita duplicados', async () => {
    const place = await create();
    const answers = { ambiente: ['acogedor', 'moderno', 'acogedor'], cafe: 'excelente', volveria: 'tal_vez', productos: ['sin_azucar'] };
    const { body } = await request(app)
      .patch(`/api/establishments/${place.id}/notes`)
      .send({ answers, observations: 'Volver por el cortado.' });
    expect(body.answers).toMatchObject({ ambiente: ['acogedor', 'moderno'], cafe: 'excelente', volveria: 'tal_vez', productos: ['sin_azucar'], precios: null });
    expect(body.observations).toBe('Volver por el cortado.');
  });

  it.each(['ambiente', 'bebidas'])('acepta "%s" como lo que más gustó', async (favorito) => {
    const place = await create();
    const { body, status } = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ answers: { favorito } });
    expect(status).toBe(200);
    expect(body.answers.favorito).toBe(favorito);
  });

  it('guarda lo que consumí, también desde el formulario completo', async () => {
    const place = await create({ offersFood: true, consumed: { bebida: 'Flat white', comida: 'Molletes' } });
    expect(place.consumed).toEqual({ bebida: 'Flat white', comida: 'Molletes', postre: '' });

    const { body } = await request(app)
      .patch(`/api/establishments/${place.id}/notes`)
      .send({ consumed: { bebida: 'V60, Cortado', comida: 'Molletes' } });
    expect(body.consumed.bebida).toBe('V60, Cortado');
  });

  it('anotar lo que consumí en un lugar pendiente lo marca como visitado', async () => {
    const place = await create({ visitStatus: 'pendiente' });
    const { body } = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ consumed: { bebida: 'Latte' } });
    expect(body.visitStatus).toBe('visitado');
  });

  it('rechaza un texto de consumo demasiado largo', async () => {
    const place = await create();
    const res = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ consumed: { bebida: 'x'.repeat(301) } });
    expect(res.status).toBe(400);
    expect(res.body.error.fields['consumed.bebida']).toBeTruthy();
  });

  it('responder las notas de un lugar pendiente lo marca como visitado', async () => {
    const place = await create({ visitStatus: 'pendiente' });
    const { body } = await request(app).patch(`/api/establishments/${place.id}/notes`).send({ answers: { cafe: 'bueno' } });
    expect(body.visitStatus).toBe('visitado');
  });

  it('un lugar con calificaciones no vuelve a pendiente desde el cambio rápido', async () => {
    const place = await create({ scores: { cafe: 8 } });
    const res = await request(app).patch(`/api/establishments/${place.id}/visit`).send({ visitStatus: 'pendiente', visitDate: null });
    expect(res.status).toBe(409);
  });
});

describe('opiniones de amigos con opciones rápidas', () => {
  it('guarda lo que pidió el amigo, y basta para registrar la opinión', async () => {
    const place = await create();
    const res = await request(app)
      .post(`/api/establishments/${place.id}/reviews`)
      .field('friendName', 'Toño')
      .field('ordered', 'Latte y rol de canela');
    expect(res.status).toBe(201);
    expect(res.body.ordered).toBe('Latte y rol de canela');

    const edited = await request(app).put(`/api/reviews/${res.body.id}`).field('friendName', 'Toño').field('ordered', 'Espresso');
    expect(edited.status).toBe(200);
    expect(edited.body.ordered).toBe('Espresso');
  });

  it('basta con responder preguntas y no altera mi calificación', async () => {
    const place = await create({ scores: { cafe: 9 } });
    const res = await request(app)
      .post(`/api/establishments/${place.id}/reviews`)
      .field('friendName', 'Lupita')
      .field('answers', JSON.stringify({ cafe: 'bueno', volveria: 'si' }));
    expect(res.status).toBe(201);
    expect(res.body.answers).toMatchObject({ cafe: 'bueno', volveria: 'si' });
    const { body } = await request(app).get(`/api/establishments/${place.id}`);
    expect(body.scores.personal).toBe(9);
    expect(body.reviews[0].friendName).toBe('Lupita');
  });

  it('rechaza una opinión vacía o con respuestas dañadas', async () => {
    const place = await create();
    const url = `/api/establishments/${place.id}/reviews`;
    expect((await request(app).post(url).field('friendName', 'Ana').field('answers', '{}')).status).toBe(400);
    expect((await request(app).post(url).field('friendName', 'Ana').field('answers', 'no-es-json')).status).toBe(400);
  });
});

describe('disponibilidad', () => {
  it('agrega, edita y elimina; la lista empieza vacía', async () => {
    const place = await create();
    expect(place.availability).toEqual([]);

    const created = await request(app)
      .post(`/api/establishments/${place.id}/availability`)
      .send({ productName: 'Croissants', note: 'Vuelan', availableWhen: 'Antes de las 10', sellsOutFast: true });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/availability/${created.body.id}`)
      .send({ productName: 'Croissants de almendra', sellsOutFast: false });
    expect(updated.body).toMatchObject({ productName: 'Croissants de almendra', sellsOutFast: false, note: '' });

    expect((await request(app).get(`/api/establishments/${place.id}`)).body.availability).toHaveLength(1);
    expect((await request(app).delete(`/api/availability/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/establishments/${place.id}`)).body.availability).toEqual([]);
  });

  it('exige el nombre del producto', async () => {
    const place = await create();
    const res = await request(app).post(`/api/establishments/${place.id}/availability`).send({ note: 'Sin nombre' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.productName).toBeTruthy();
  });
});

describe('productos de temporada', () => {
  const add = async (id: number) =>
    request(app)
      .post(`/api/establishments/${id}/seasonal`)
      .field('name', 'Rol de calabaza')
      .field('triedOn', '2026-10-01')
      .field('note', 'Muy especiado')
      .field('status', 'temporal')
      .attach('photo', await jpg(), 'rol.jpg');

  it('permite varios por lugar, con fotografía opcional', async () => {
    const place = await create();
    expect((await add(place.id)).status).toBe(201);
    const second = await request(app)
      .post(`/api/establishments/${place.id}/seasonal`)
      .field('name', 'Ponche')
      .field('triedOn', '2026-10-20')
      .field('status', 'disponible');
    expect(second.status).toBe(201);
    expect(second.body.photoUrl).toBeNull();
    const { body } = await request(app).get(`/api/establishments/${place.id}`);
    expect(body.seasonal.map((item: { name: string }) => item.name)).toEqual(['Ponche', 'Rol de calabaza']);
  });

  it('rechaza fecha futura y estado desconocido', async () => {
    const place = await create();
    const res = await request(app)
      .post(`/api/establishments/${place.id}/seasonal`)
      .field('name', 'X')
      .field('triedOn', '2999-01-01')
      .field('status', 'quizas');
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['triedOn', 'status']));
  });

  it('borra el archivo al quitar la foto y al eliminar el lugar', async () => {
    const folder = path.join(dataDir, 'uploads', 'seasonal');
    const place = await create();
    const created = await add(place.id);
    const before = fs.readdirSync(folder).length;
    const edited = await request(app)
      .put(`/api/seasonal/${created.body.id}`)
      .field('name', 'Rol de calabaza')
      .field('triedOn', '2026-10-01')
      .field('status', 'temporal')
      .field('removePhoto', 'true');
    expect(edited.body.photoUrl).toBeNull();
    expect(fs.readdirSync(folder).length).toBe(before - 2);

    await add(place.id);
    expect(fs.readdirSync(folder).length).toBe(before);
    await request(app).delete(`/api/establishments/${place.id}`);
    expect(fs.readdirSync(folder).length).toBe(before - 2);
  });

  it('el respaldo incluye sus fotografías y se puede restaurar', async () => {
    const place = await create({ name: 'Con temporada' });
    const created = await add(place.id);
    const backup = await request(app).post('/api/backups');
    expect(backup.status).toBe(201);
    await request(app).delete(`/api/establishments/${place.id}`);

    const restored = await request(app).post(`/api/backups/${backup.body.name}/restore`);
    expect(restored.status).toBe(200);
    const { body } = await request(app).get(`/api/establishments/${place.id}`);
    expect(body.seasonal[0].id).toBe(created.body.id);
    expect((await request(app).get(body.seasonal[0].photoUrl)).status).toBe(200);
  });
});

describe('categoría de fotografías', () => {
  it('se elige al subir y se puede cambiar', async () => {
    const place = await create();
    const uploaded = await request(app)
      .post(`/api/establishments/${place.id}/photos`)
      .field('category', 'postres')
      .attach('photos', await jpg(), 'a.jpg');
    expect(uploaded.body[0].category).toBe('postres');
    const changed = await request(app).patch(`/api/photos/${uploaded.body[0].id}/category`).send({ category: 'bebidas' });
    expect(changed.body[0].category).toBe('bebidas');
    expect((await request(app).patch(`/api/photos/${uploaded.body[0].id}/category`).send({ category: 'x' })).status).toBe(400);
  });
});

describe('enlace de Google Maps', () => {
  const FULL =
    'https://www.google.com/maps/place/Caf%C3%A9+Ejemplo/@20.6700,-103.3700,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d20.6736!4d-103.3612';
  const resolve = (url: string) => request(app).post('/api/google-maps/resolve').send({ url });

  const placesResponse = (place: Record<string, unknown>) =>
    new Response(JSON.stringify({ places: [place] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  it('completa con Places API y prefiere las coordenadas exactas del enlace', async () => {
    const fetchMock = vi.fn(async () =>
      placesResponse({
        id: 'ChIJprueba',
        displayName: { text: 'Café Ejemplo' },
        formattedAddress: 'Calle de Prueba 1, Americana, Guadalajara',
        location: { latitude: 20.6737, longitude: -103.3613 },
        addressComponents: [{ longText: 'Americana', types: ['neighborhood'] }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { body, status } = await resolve(FULL);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      name: 'Café Ejemplo',
      address: 'Calle de Prueba 1, Americana, Guadalajara',
      neighborhood: 'Americana',
      latitude: 20.6736,
      longitude: -103.3612,
      googlePlaceId: 'ChIJprueba',
      googleMapsUrl: FULL,
      source: 'places',
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('clave-de-prueba');
    // La clave nunca viaja al navegador.
    expect(JSON.stringify(body)).not.toContain('clave-de-prueba');
  });

  it('descarta un resultado de Places lejos del punto del enlace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      placesResponse({ id: 'otro', displayName: { text: 'Otro lugar' }, formattedAddress: 'Lejos', location: { latitude: 19.4, longitude: -99.1 } }),
    ));
    const { body } = await resolve(FULL);
    expect(body).toMatchObject({ name: 'Café Ejemplo', address: null, latitude: 20.6736, source: 'link', googlePlaceId: null });
    expect(body.warnings.join(' ')).toContain('descartó');
  });

  it('si Places falla, conserva lo que trae el enlace y lo avisa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    const { body, status } = await resolve(FULL);
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: 'Café Ejemplo', latitude: 20.6736, source: 'link' });
    expect(body.warnings.join(' ')).toContain('clave');
  });

  it('sigue un enlace corto validando cada salto', async () => {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url.startsWith('https://maps.app.goo.gl/')) return new Response(null, { status: 302, headers: { location: FULL } });
      return placesResponse({ id: 'ChIJcorto', displayName: { text: 'Café Ejemplo' }, location: { latitude: 20.6736, longitude: -103.3612 } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const short = 'https://maps.app.goo.gl/abc123';
    const { body } = await resolve(short);
    expect(body).toMatchObject({ name: 'Café Ejemplo', latitude: 20.6736, googleMapsUrl: short });
  });

  it('sigue un enlace de share.google por su salto intermedio y busca en Guadalajara', async () => {
    // Misma cadena de redirecciones que hace Google con estos enlaces.
    const hops: Record<string, string> = {
      'https://share.google/abc': 'https://www.google.com/share.google?q=abc',
      'https://www.google.com/share.google?q=abc': 'https://www.google.com/search?kgmid=/g/1&hl=es-MX&q=Caf%C3%A9+Ejemplo',
    };
    const fetchMock = vi.fn(async (input: URL | string) => {
      const next = hops[String(input)];
      if (next) return new Response(null, { status: 302, headers: { location: next } });
      return placesResponse({ id: 'ChIJshare', displayName: { text: 'Café Ejemplo' }, location: { latitude: 20.67, longitude: -103.36 } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { body, status } = await resolve('https://share.google/abc');
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: 'Café Ejemplo', latitude: 20.67, googleMapsUrl: 'https://share.google/abc', source: 'places' });
    expect(body.warnings.join(' ')).toContain('sucursal');
    const search = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(JSON.parse(String(search[1].body)).locationBias.circle.center.latitude).toBeCloseTo(20.67, 1);
  });

  it('no sigue una redirección fuera de Google', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await resolve('https://maps.app.goo.gl/malo');
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    'https://example.com/maps/place/x',
    'https://www.google.com.evil.com/maps/place/x',
    'http://www.google.com/maps/place/x',
    'https://www.google.com/mail',
    'javascript:alert(1)',
    'no es un enlace',
  ])('rechaza sin abrirlo: %s', async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await resolve(url);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
