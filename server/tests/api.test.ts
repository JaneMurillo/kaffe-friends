import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';

// La carpeta de datos se define antes de importar la aplicación: nunca toca los datos reales.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaffe-test-'));
process.env.DATA_DIR = dataDir;
// Vacías a propósito: un archivo .env real no debe influir en las pruebas.
process.env.APP_PASSWORD = '';
process.env.GOOGLE_MAPS_API_KEY = '';

let app: Express;
let closeDatabase: () => void;
let openDatabase: () => unknown;

const base = {
  type: 'cafeteria',
  address: 'Calle de prueba 1',
  neighborhood: 'Americana',
  visitStatus: 'visitado',
  visitDate: '2026-01-10',
  description: '',
  inPassport: false,
  offersDrinks: true,
  offersFood: false,
  offersDesserts: false,
  ratings: {},
};

const png = () =>
  sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#76513d' } }).png().toBuffer();

async function create(overrides: Record<string, unknown>) {
  const res = await request(app).post('/api/establishments').send({ ...base, ...overrides });
  expect(res.status).toBe(201);
  return res.body;
}

async function clearAll() {
  const { body } = await request(app).get('/api/establishments');
  for (const place of body) await request(app).delete(`/api/establishments/${place.id}`);
}

beforeAll(async () => {
  const appModule = await import('../src/app.js');
  const connection = await import('../src/db/connection.js');
  closeDatabase = connection.closeDatabase;
  openDatabase = connection.openDatabase;
  openDatabase();
  app = appModule.createApp();
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('lugares', () => {
  it('crea, edita y elimina, y calcula la calificación general (9 y 8 = 8.5)', async () => {
    const place = await create({
      name: 'Café Uno',
      offersFood: true,
      ratings: { bebidas: { score: 9 }, comida: { score: 8 } },
    });
    expect(place.scores.personal).toBe(8.5);

    const updated = await request(app)
      .put(`/api/establishments/${place.id}`)
      .send({ ...base, name: 'Café Uno Editado', type: 'panaderia', ratings: { bebidas: { score: 7 } } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Café Uno Editado');
    expect(updated.body.type).toBe('panaderia');
    expect(updated.body.ratings.comida).toBeNull();
    expect(updated.body.scores.personal).toBe(7);

    expect((await request(app).delete(`/api/establishments/${place.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/establishments/${place.id}`)).status).toBe(404);
  });

  it('muestra "sin calificar" como null, no como cero', async () => {
    const place = await create({ name: 'Sin notas' });
    expect(place.scores.personal).toBeNull();
    await clearAll();
  });

  it.each([
    ['nombre vacío', { name: '  ' }, 'name'],
    ['categoría que ya no existe', { name: 'x', type: 'ambas' }, 'type'],
    ['enlace que no es de Google Maps', { name: 'x', googleMapsUrl: 'https://example.com/maps' }, 'googleMapsUrl'],
    ['respuesta desconocida', { name: 'x', answers: { cafe: 'genial' } }, 'answers.cafe'],
    [
      'pendiente con calificación por aspecto',
      { name: 'x', visitStatus: 'pendiente', visitDate: null, scores: { cafe: 8 } },
      'scores.cafe',
    ],
    ['calificar comida que no ofrece', { name: 'x', ratings: { comida: { score: 8 } } }, 'ratings.comida.score'],
    ['calificación 11', { name: 'x', ratings: { bebidas: { score: 11 } } }, 'ratings.bebidas.score'],
    ['calificación 0', { name: 'x', ratings: { bebidas: { score: 0 } } }, 'ratings.bebidas.score'],
    ['fecha futura', { name: 'x', visitDate: '2999-01-01' }, 'visitDate'],
    ['fecha inexistente', { name: 'x', visitDate: '2026-02-31' }, 'visitDate'],
    ['latitud sin longitud', { name: 'x', latitude: 20.6 }, 'latitude'],
    [
      'pendiente con calificación',
      { name: 'x', visitStatus: 'pendiente', visitDate: null, ratings: { bebidas: { score: 8 } } },
      'ratings.bebidas.score',
    ],
  ])('rechaza registros inconsistentes: %s', async (_label, overrides, field) => {
    const res = await request(app).post('/api/establishments').send({ ...base, ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error.fields[field as string]).toBeTruthy();
  });
});

describe('filtros y secciones', () => {
  beforeAll(async () => {
    await clearAll();
    await create({ name: 'Cafetería Ñandú', ratings: { bebidas: { score: 9 } }, inPassport: true });
    await create({
      name: 'Panadería Sol',
      type: 'panaderia',
      neighborhood: 'Santa Tere',
      offersDrinks: false,
      offersDesserts: true,
      ratings: { postres: { score: 6 } },
    });
    await create({
      name: 'Casa Mixta',
      type: 'cafeteria',
      neighborhood: 'americana',
      offersFood: true,
      visitDate: '2026-03-01',
      ratings: { bebidas: { score: 8 } },
    });
    await create({ name: 'Pendiente', visitStatus: 'pendiente', visitDate: null, inPassport: true });
  });

  const names = async (query: string) =>
    (await request(app).get(`/api/establishments?${query}`)).body.map((place: { name: string }) => place.name);

  it('busca por nombre sin distinguir acentos ni mayúsculas', async () => {
    expect(await names('q=CAFETERIA')).toEqual(['Cafetería Ñandú']);
  });

  it('las secciones por tipo solo incluyen su categoría', async () => {
    expect((await names('type=cafeteria&sort=name')).sort()).toEqual(['Cafetería Ñandú', 'Casa Mixta', 'Pendiente']);
    expect((await names('type=panaderia&sort=name')).sort()).toEqual(['Panadería Sol']);
  });

  it('filtra por comida, pasaporte y calificación', async () => {
    expect(await names('food=true')).toEqual(['Casa Mixta']);
    // La colonia ya no filtra: el parámetro se ignora.
    expect(await names('neighborhood=Americana')).toHaveLength(4);
    expect((await names('passport=true')).sort()).toEqual(['Cafetería Ñandú', 'Pendiente']);
    expect((await names('minScore=8&sort=score'))).toEqual(['Cafetería Ñandú', 'Casa Mixta']);
    expect(await names('unrated=true')).toEqual(['Pendiente']);
  });

  it('ordena por nombre, fecha y calificación dejando los vacíos al final', async () => {
    expect((await names('sort=name'))[0]).toBe('Cafetería Ñandú');
    expect(await names('sort=score')).toEqual(['Cafetería Ñandú', 'Casa Mixta', 'Panadería Sol', 'Pendiente']);
    expect((await names('sort=score&dir=asc'))[3]).toBe('Pendiente');
    expect((await names('sort=visitDate'))[0]).toBe('Casa Mixta');
  });

  it('las colonias no se duplican por mayúsculas', async () => {
    const { body } = await request(app).get('/api/establishments/neighborhoods');
    expect(body).toEqual(['Americana', 'Santa Tere']);
  });

  it('calcula el avance del pasaporte', async () => {
    const { body } = await request(app).get('/api/passport');
    expect(body).toMatchObject({ total: 2, visited: 1, pending: 1, percent: 50 });
  });

  it('calcula las estadísticas de inicio', async () => {
    const { body } = await request(app).get('/api/stats');
    expect(body).toMatchObject({ total: 4, cafeterias: 3, panaderias: 1 });
    expect(body.averagePersonal).toBeCloseTo((9 + 6 + 8) / 3, 1);
  });
});

describe('opiniones de amigos y rankings', () => {
  let a: { id: number };
  let b: { id: number };

  beforeAll(async () => {
    await clearAll();
    a = await create({ name: 'Lugar A', ratings: { bebidas: { score: 9 } } });
    b = await create({ name: 'Lugar B', ratings: { bebidas: { score: 7 } } });
  });

  it('las opiniones no cambian mi calificación ni el Top, solo el ranking comunitario', async () => {
    const standings = async () =>
      (await request(app).get('/api/rankings?kind=personal')).body.map(
        (entry: { place: { name: string; scores: { personal: number } }; position: number; score: number }) => ({
          name: entry.place.name,
          position: entry.position,
          score: entry.score,
          personal: entry.place.scores.personal,
        }),
      );
    const before = await standings();

    await request(app).post(`/api/establishments/${a.id}/reviews`).field('friendName', 'Ana').field('score', '1');
    await request(app).post(`/api/establishments/${b.id}/reviews`).field('friendName', 'Ana').field('score', '10');
    await request(app).post(`/api/establishments/${b.id}/reviews`).field('friendName', 'Luis').field('score', '10');

    const after = await standings();
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({ name: 'Lugar A', position: 1, score: 9 });

    const community = (await request(app).get('/api/rankings?kind=community')).body;
    expect(community[0].place.name).toBe('Lugar B');
    expect(community[0].score).toBe(9); // (7 + 10 + 10) / 3
    expect(community[1].score).toBe(5); // (9 + 1) / 2

    const detail = (await request(app).get(`/api/establishments/${b.id}`)).body;
    expect(detail.scores).toMatchObject({ personal: 7, friends: 10, community: 9, friendCount: 2 });
  });

  it('el ranking se invierte y conserva las posiciones', async () => {
    const asc = (await request(app).get('/api/rankings?dir=asc')).body;
    expect(asc[0].place.name).toBe('Lugar B');
    expect(asc[0].position).toBe(2);
  });

  it('los empates comparten posición', async () => {
    const tie = await create({ name: 'Lugar C', ratings: { bebidas: { score: 9 } } });
    const ranking = (await request(app).get('/api/rankings')).body;
    expect(ranking.map((entry: { position: number }) => entry.position)).toEqual([1, 1, 3]);
    await request(app).delete(`/api/establishments/${tie.id}`);
  });

  it('agrupa al amigo sin distinguir mayúsculas y muestra su historial', async () => {
    await request(app).post(`/api/establishments/${a.id}/reviews`).field('friendName', '  ANA ').field('score', '5');
    const friends = (await request(app).get('/api/friends')).body;
    expect(friends.map((friend: { name: string }) => friend.name)).toEqual(['Ana', 'Luis']);
    const ana = friends[0];
    expect(ana.reviewCount).toBe(3);

    const history = (await request(app).get(`/api/friends/${ana.id}`)).body;
    expect(history.reviews).toHaveLength(3);
    expect(history.reviews[0].establishment.name).toBeTruthy();
  });

  it('una opinión necesita calificación o comentario; sin calificación no cuenta en promedios', async () => {
    const empty = await request(app).post(`/api/establishments/${a.id}/reviews`).field('friendName', 'Eva');
    expect(empty.status).toBe(400);

    const before = (await request(app).get(`/api/establishments/${a.id}`)).body.scores;
    const res = await request(app)
      .post(`/api/establishments/${a.id}/reviews`)
      .field('friendName', 'Eva')
      .field('comment', 'Muy rico');
    expect(res.status).toBe(201);
    expect(res.body.score).toBeNull();
    const after = (await request(app).get(`/api/establishments/${a.id}`)).body.scores;
    expect(after).toEqual(before);
  });

  it('edita y elimina opiniones, y quita al amigo que se queda sin ninguna', async () => {
    const created = (
      await request(app).post(`/api/establishments/${a.id}/reviews`).field('friendName', 'Temporal').field('score', '4')
    ).body;
    const edited = await request(app).put(`/api/reviews/${created.id}`).field('friendName', 'Temporal').field('score', '6');
    expect(edited.body.score).toBe(6);

    expect((await request(app).delete(`/api/reviews/${created.id}`)).status).toBe(204);
    const friends = (await request(app).get('/api/friends')).body;
    expect(friends.some((friend: { name: string }) => friend.name === 'Temporal')).toBe(false);
  });
});

describe('fotografías', () => {
  let place: { id: number };
  const uploadsDir = () => path.join(dataDir, 'uploads', 'establishments');

  beforeAll(async () => {
    await clearAll();
    place = await create({ name: 'Con fotos' });
  });

  it('guarda varias, las optimiza y permite elegir la principal', async () => {
    const res = await request(app)
      .post(`/api/establishments/${place.id}/photos`)
      .attach('photos', await png(), 'uno.png')
      .attach('photos', await png(), 'dos.png')
      .field('mainIndex', '1');
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].isMain).toBe(true);
    expect(res.body[0].width).toBe(2000); // Reducida desde 3000 px.
    expect(res.body[0].url).toMatch(/\.webp$/);

    const media = await request(app).get(res.body[0].url);
    expect(media.status).toBe(200);
    expect(media.headers['content-type']).toContain('image/webp');
    expect(fs.readdirSync(uploadsDir())).toHaveLength(4); // Dos imágenes + dos miniaturas.
  });

  it('rechaza un archivo que no es imagen sin dejar basura', async () => {
    const before = fs.readdirSync(uploadsDir()).length;
    const res = await request(app)
      .post(`/api/establishments/${place.id}/photos`)
      .attach('photos', Buffer.from('esto no es una imagen'), 'falsa.png');
    expect(res.status).toBe(400);
    expect(fs.readdirSync(uploadsDir())).toHaveLength(before);
  });

  it('al borrar la principal, otra toma su lugar y los archivos desaparecen', async () => {
    const detail = (await request(app).get(`/api/establishments/${place.id}`)).body;
    const main = detail.photos.find((photo: { isMain: boolean }) => photo.isMain);
    const res = await request(app).delete(`/api/photos/${main.id}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isMain).toBe(true);
    expect(fs.readdirSync(uploadsDir())).toHaveLength(2);
  });

  it('al borrar el lugar se borran sus archivos', async () => {
    await request(app).delete(`/api/establishments/${place.id}`);
    expect(fs.readdirSync(uploadsDir())).toHaveLength(0);
  });
});

describe('respaldos', () => {
  it('recupera datos y fotografías tal como estaban', async () => {
    await clearAll();
    const place = await create({ name: 'Antes del respaldo', ratings: { bebidas: { score: 9 } } });
    await request(app).post(`/api/establishments/${place.id}/photos`).attach('photos', await png(), 'a.png');
    await request(app)
      .post(`/api/establishments/${place.id}/reviews`)
      .field('friendName', 'Ana')
      .field('score', '8')
      .attach('photo', await png(), 'r.png');

    const backup = (await request(app).post('/api/backups')).body;
    expect(backup.name).toMatch(/\.zip$/);

    // Se pierde todo.
    await clearAll();
    expect((await request(app).get('/api/establishments')).body).toHaveLength(0);

    const restored = await request(app).post(`/api/backups/${backup.name}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.safetyBackup).toMatch(/antes-de-restaurar/);

    const list = (await request(app).get('/api/establishments')).body;
    expect(list).toHaveLength(1);
    const detail = (await request(app).get(`/api/establishments/${list[0].id}`)).body;
    expect(detail.name).toBe('Antes del respaldo');
    expect(detail.scores).toMatchObject({ personal: 9, friends: 8 });
    expect((await request(app).get(detail.photos[0].url)).status).toBe(200);
    expect((await request(app).get(detail.reviews[0].photoUrl)).status).toBe(200);
  });

  it('restaura desde un ZIP subido', async () => {
    const backup = (await request(app).post('/api/backups')).body;
    const file = path.join(dataDir, 'backups', backup.name);
    await clearAll();
    const res = await request(app).post('/api/backups/restore').attach('backup', file);
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/establishments')).body).toHaveLength(1);
  });

  it('rechaza un ZIP ajeno o con rutas peligrosas sin tocar los datos', async () => {
    const foreign = new AdmZip();
    foreign.addFile('manifest.json', Buffer.from('{"app":"otra","schemaVersion":1}'));
    foreign.addFile('kaffe.db', Buffer.from('x'));
    const bad = await request(app)
      .post('/api/backups/restore')
      .attach('backup', foreign.toBuffer(), 'ajeno.zip');
    expect(bad.status).toBe(400);

    const traversal = new AdmZip();
    traversal.addFile('manifest.json', Buffer.from('{"app":"los-amigos-del-kaffe","schemaVersion":1}'));
    traversal.addFile('kaffe.db', Buffer.from('x'));
    traversal.addFile('uploads/evil.js', Buffer.from('x'));
    const evil = await request(app)
      .post('/api/backups/restore')
      .attach('backup', traversal.toBuffer(), 'malo.zip');
    expect(evil.status).toBe(400);

    const corrupt = new AdmZip();
    corrupt.addFile('manifest.json', Buffer.from('{"app":"los-amigos-del-kaffe","schemaVersion":1}'));
    corrupt.addFile('kaffe.db', Buffer.from('no soy sqlite'));
    const broken = await request(app)
      .post('/api/backups/restore')
      .attach('backup', corrupt.toBuffer(), 'danado.zip');
    expect(broken.status).toBe(400);

    expect((await request(app).get('/api/establishments')).body).toHaveLength(1);
  });

  it('los datos persisten al cerrar y volver a abrir la base de datos', async () => {
    closeDatabase();
    openDatabase();
    expect((await request(app).get('/api/establishments')).body).toHaveLength(1);
  });

  it('no permite salir de la carpeta de respaldos', async () => {
    expect((await request(app).get('/api/backups/..%2Fkaffe.db/download')).status).toBe(404);
  });
});

describe('protección de la API local', () => {
  it('rechaza escrituras desde otro origen y hosts ajenos', async () => {
    const crossOrigin = await request(app)
      .post('/api/backups')
      .set('Origin', 'https://sitio-malicioso.example');
    expect(crossOrigin.status).toBe(403);

    const rebinding = await request(app).get('/api/stats').set('Host', 'sitio-malicioso.example');
    expect(rebinding.status).toBe(403);
  });
});
