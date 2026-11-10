import { getDb } from '../db/connection.js';
import { nowIso } from '../utils.js';

export type PhotoCategory = 'lugar' | 'bebidas' | 'comida' | 'postres';

export interface PhotoRow {
  id: number;
  establishment_id: number;
  filename: string;
  thumb_filename: string;
  width: number;
  height: number;
  is_main: number;
  category: PhotoCategory;
  created_at: string;
}

export const photoModel = {
  findAll(): PhotoRow[] {
    return getDb().prepare('SELECT * FROM photos ORDER BY is_main DESC, id').all() as PhotoRow[];
  },

  findByEstablishment(establishmentId: number): PhotoRow[] {
    return getDb()
      .prepare('SELECT * FROM photos WHERE establishment_id = ? ORDER BY is_main DESC, id')
      .all(establishmentId) as PhotoRow[];
  },

  findById(id: number): PhotoRow | undefined {
    return getDb().prepare('SELECT * FROM photos WHERE id = ?').get(id) as PhotoRow | undefined;
  },

  insert(
    establishmentId: number,
    photo: { filename: string; thumbFilename: string; width: number; height: number },
    category: PhotoCategory = 'lugar',
  ): number {
    const result = getDb()
      .prepare(
        `INSERT INTO photos (establishment_id, filename, thumb_filename, width, height, is_main, category, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(establishmentId, photo.filename, photo.thumbFilename, photo.width, photo.height, category, nowIso());
    return Number(result.lastInsertRowid);
  },

  setMain(establishmentId: number, photoId: number): void {
    const db = getDb();
    db.transaction(() => {
      db.prepare('UPDATE photos SET is_main = 0 WHERE establishment_id = ?').run(establishmentId);
      db.prepare('UPDATE photos SET is_main = 1 WHERE id = ?').run(photoId);
    })();
  },

  setCategory(id: number, category: PhotoCategory): void {
    getDb().prepare('UPDATE photos SET category = ? WHERE id = ?').run(category, id);
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM photos WHERE id = ?').run(id);
  },
};
