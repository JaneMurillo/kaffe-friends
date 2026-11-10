import { getDb } from '../db/connection.js';
import { nowIso } from '../utils.js';

export interface AvailabilityRow {
  id: number;
  establishment_id: number;
  product_name: string;
  note: string;
  available_when: string;
  sells_out_fast: number;
  created_at: string;
}

export interface AvailabilityWrite {
  productName: string;
  note: string;
  availableWhen: string;
  sellsOutFast: boolean;
}

export const availabilityModel = {
  findByEstablishment(id: number): AvailabilityRow[] {
    return getDb()
      .prepare('SELECT * FROM availability_items WHERE establishment_id = ? ORDER BY sells_out_fast DESC, id')
      .all(id) as AvailabilityRow[];
  },

  findById(id: number): AvailabilityRow | undefined {
    return getDb().prepare('SELECT * FROM availability_items WHERE id = ?').get(id) as AvailabilityRow | undefined;
  },

  insert(establishmentId: number, data: AvailabilityWrite): number {
    const result = getDb()
      .prepare(
        `INSERT INTO availability_items (establishment_id, product_name, note, available_when, sells_out_fast, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(establishmentId, data.productName, data.note, data.availableWhen, Number(data.sellsOutFast), nowIso());
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: AvailabilityWrite): void {
    getDb()
      .prepare('UPDATE availability_items SET product_name = ?, note = ?, available_when = ?, sells_out_fast = ? WHERE id = ?')
      .run(data.productName, data.note, data.availableWhen, Number(data.sellsOutFast), id);
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM availability_items WHERE id = ?').run(id);
  },
};

export interface SeasonalRow {
  id: number;
  establishment_id: number;
  name: string;
  tried_on: string;
  note: string;
  status: 'disponible' | 'temporal';
  photo_filename: string | null;
  photo_thumb_filename: string | null;
  created_at: string;
}

export interface SeasonalWrite {
  name: string;
  triedOn: string;
  note: string;
  status: 'disponible' | 'temporal';
  photoFilename: string | null;
  photoThumbFilename: string | null;
}

export const seasonalModel = {
  findByEstablishment(id: number): SeasonalRow[] {
    return getDb()
      .prepare('SELECT * FROM seasonal_products WHERE establishment_id = ? ORDER BY tried_on DESC, id DESC')
      .all(id) as SeasonalRow[];
  },

  findById(id: number): SeasonalRow | undefined {
    return getDb().prepare('SELECT * FROM seasonal_products WHERE id = ?').get(id) as SeasonalRow | undefined;
  },

  insert(establishmentId: number, data: SeasonalWrite): number {
    const result = getDb()
      .prepare(
        `INSERT INTO seasonal_products
           (establishment_id, name, tried_on, note, status, photo_filename, photo_thumb_filename, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(establishmentId, data.name, data.triedOn, data.note, data.status, data.photoFilename, data.photoThumbFilename, nowIso());
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: SeasonalWrite): void {
    getDb()
      .prepare(
        `UPDATE seasonal_products SET name = ?, tried_on = ?, note = ?, status = ?,
                photo_filename = ?, photo_thumb_filename = ? WHERE id = ?`,
      )
      .run(data.name, data.triedOn, data.note, data.status, data.photoFilename, data.photoThumbFilename, id);
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM seasonal_products WHERE id = ?').run(id);
  },
};
