import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaffe-migration-'));
process.env.DATA_DIR = dataDir;
process.env.APP_PASSWORD = '';

const NOW = '2026-01-01T00:00:00.000Z';
let connection: typeof import('../src/db/connection.js');

/** Crea una base con el esquema v1, igual a la que existía antes de esta actualización. */
async function seedV1() {
  const { migrations } = await import('../src/db/migrations.js');
  const db = new Database(path.join(dataDir, 'kaffe.db'));
  db.exec(migrations[0]!);
  db.pragma('user_version = 1');
  const place = db.prepare(
    `INSERT INTO establishments (id, name, type, address, neighborhood, latitude, longitude, visit_status, visit_date,
       description, in_passport, offers_drinks, offers_food, offers_desserts, created_at, updated_at)
     VALUES (?, ?, ?, 'Calle 1', 'Centro', 20.6, -103.3, 'visitado', '2026-01-01', 'Mis palabras', 1, 1, 1, 0, ?, ?)`,
  );
  place.run(1, 'Café Viejo', 'cafeteria', NOW, NOW);
  place.run(2, 'Casa Mixta', 'ambas', NOW, NOW);
  db.prepare(
    `INSERT INTO establishments (id, name, type, address, neighborhood, visit_status, created_at, updated_at)
     VALUES (3, 'Con enlace', 'cafeteria', 'https://share.google/abc123', 'Americana', 'pendiente', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO establishments (id, name, type, address, neighborhood, visit_status, created_at, updated_at)
     VALUES (4, 'Otro enlace', 'cafeteria', 'https://example.com/lugar', 'Centro', 'pendiente', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(`INSERT INTO ratings VALUES (1, 'bebidas', 9, 'Rico', 'Latte')`).run();
  db.prepare(`INSERT INTO ratings VALUES (1, 'comida', 8, '', '')`).run();
  db.prepare(`INSERT INTO photos (id, establishment_id, filename, thumb_filename, width, height, is_main, created_at)
              VALUES (1, 1, 'a.webp', 'a.thumb.webp', 10, 10, 1, ?)`).run(NOW);
  db.prepare(`INSERT INTO friends (id, name) VALUES (1, 'Ana')`).run();
  db.prepare(`INSERT INTO reviews (id, establishment_id, friend_id, score, comment, created_at, updated_at)
              VALUES (1, 1, 1, 10, 'Me encantó', ?, ?)`).run(NOW, NOW);
  db.close();
}

beforeAll(async () => {
  await seedV1();
  connection = await import('../src/db/connection.js');
  connection.openDatabase();
});

afterAll(() => {
  connection.closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('actualización desde el esquema anterior', () => {
  it('conserva lugares, calificaciones, fotografías y opiniones', async () => {
    const { getEstablishment } = await import('../src/services/establishments.service.js');
    const place = getEstablishment(1);
    expect(place).toMatchObject({ name: 'Café Viejo', address: 'Calle 1', description: 'Mis palabras', inPassport: true, latitude: 20.6 });
    expect(place.ratings.bebidas).toMatchObject({ score: 9, comment: 'Rico', highlights: 'Latte' });
    expect(place.scores.personal).toBe(8.5);
    expect(place.photos[0]).toMatchObject({ id: 1, isMain: true, category: 'lugar' });
    expect(place.reviews[0]).toMatchObject({ friendName: 'Ana', score: 10, comment: 'Me encantó' });
    expect(place.availability).toEqual([]);
    expect(place.consumed).toEqual({ bebida: '', comida: '', postre: '' });
    expect(place.seasonal).toEqual([]);
  });

  it('convierte la categoría anterior "ambas" en cafetería', async () => {
    const { getEstablishment } = await import('../src/services/establishments.service.js');
    expect(getEstablishment(2).type).toBe('cafeteria');
  });

  it('un enlace de Google Maps escrito como dirección pasa a su propio campo', async () => {
    const { getEstablishment } = await import('../src/services/establishments.service.js');
    expect(getEstablishment(3)).toMatchObject({ address: '', googleMapsUrl: 'https://share.google/abc123' });
    expect(getEstablishment(1)).toMatchObject({ address: 'Calle 1', googleMapsUrl: null });
    // Cualquier otro texto se conserva tal como estaba.
    expect(getEstablishment(4)).toMatchObject({ address: 'https://example.com/lugar', googleMapsUrl: null });
  });

  it('la migración 4 retira postres de temporada y bebidas especiales sin tocar lo demás', async () => {
    const { migrations } = await import('../src/db/migrations.js');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE establishments (id INTEGER PRIMARY KEY, answers TEXT NOT NULL); CREATE TABLE reviews (id INTEGER PRIMARY KEY, answers TEXT NOT NULL);');
    const full = JSON.stringify({ cafe: 'bueno', productos: ['postres', 'postres_temporada', 'especiales', 'sin_azucar'] });
    db.prepare('INSERT INTO establishments (id, answers) VALUES (1, ?), (2, ?), (3, ?)').run(full, '{}', 'dañado');
    db.prepare('INSERT INTO reviews (id, answers) VALUES (1, ?)').run(JSON.stringify({ productos: ['especiales'] }));
    db.exec(migrations[3]!);
    const read = (table: string, id: number) => (db.prepare(`SELECT answers FROM ${table} WHERE id = ?`).get(id) as { answers: string }).answers;
    expect(JSON.parse(read('establishments', 1))).toEqual({ cafe: 'bueno', productos: ['postres', 'sin_azucar'] });
    expect(read('establishments', 2)).toBe('{}');
    expect(read('establishments', 3)).toBe('dañado');
    expect(JSON.parse(read('reviews', 1))).toEqual({ productos: [] });
    db.close();
  });

  it('guarda una copia previa y deja las llaves foráneas activas', async () => {
    const { LATEST_SCHEMA_VERSION } = await import('../src/db/migrations.js');
    expect(fs.readdirSync(path.join(dataDir, 'backups')).some((name) => name.startsWith('antes-de-migrar-v1'))).toBe(true);
    const db = connection.getDb();
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION);
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });

  it('la migración 5 agrega juegos de mesa y bebidas de temporada, apagados por omisión', async () => {
    const { getEstablishment } = await import('../src/services/establishments.service.js');
    const id = (connection.getDb().prepare('SELECT id FROM establishments LIMIT 1').get() as { id: number }).id;
    expect(getEstablishment(id)).toMatchObject({ offersBoardGames: false, offersSeasonalDrinks: false });
  });

  it('las llaves foráneas siguen en cascada después de reconstruir la tabla', async () => {
    const { deleteEstablishment } = await import('../src/services/establishments.service.js');
    deleteEstablishment(1);
    const db = connection.getDb();
    const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
    expect([count('ratings'), count('photos'), count('reviews')]).toEqual([0, 0, 0]);
  });
});
