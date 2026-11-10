import { getDb } from '../db/connection.js';
import type { Category } from '../services/scores.service.js';
import { nowIso } from '../utils.js';

export type EstablishmentType = 'cafeteria' | 'panaderia';
export type VisitStatus = 'visitado' | 'pendiente';

export interface EstablishmentRow {
  id: number;
  name: string;
  type: EstablishmentType;
  address: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  visit_status: VisitStatus;
  visit_date: string | null;
  description: string;
  in_passport: number;
  offers_drinks: number;
  offers_food: number;
  offers_desserts: number;
  offers_sugar_free: number;
  offers_board_games: number;
  offers_seasonal_drinks: number;
  google_maps_url: string | null;
  google_place_id: string | null;
  observations: string;
  consumed_drink: string;
  consumed_food: string;
  consumed_dessert: string;
  answers: string;
  score_cafe: number | null;
  score_bebidas: number | null;
  score_comida: number | null;
  score_ambiente: number | null;
  score_precios: number | null;
  score_atencion: number | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface RatingRow {
  establishment_id: number;
  category: Category;
  score: number | null;
  comment: string;
  highlights: string;
}

export interface DetailScores {
  cafe: number | null;
  bebidas: number | null;
  comida: number | null;
  ambiente: number | null;
  precios: number | null;
  atencion: number | null;
}

export interface Consumed {
  bebida: string;
  comida: string;
  postre: string;
}

export interface NotesWrite {
  observations: string;
  consumed: Consumed;
  answers: unknown;
  scores: DetailScores;
}

export interface EstablishmentWrite extends NotesWrite {
  name: string;
  type: EstablishmentType;
  address: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  visitStatus: VisitStatus;
  visitDate: string | null;
  description: string;
  inPassport: boolean;
  offersDrinks: boolean;
  offersFood: boolean;
  offersDesserts: boolean;
  offersSugarFree: boolean;
  offersBoardGames: boolean;
  offersSeasonalDrinks: boolean;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  isDemo?: boolean;
}

export interface RatingWrite {
  score: number | null;
  comment: string;
  highlights: string;
}

const bindNotes = (data: NotesWrite) => ({
  observations: data.observations,
  consumed_drink: data.consumed.bebida,
  consumed_food: data.consumed.comida,
  consumed_dessert: data.consumed.postre,
  answers: JSON.stringify(data.answers),
  score_cafe: data.scores.cafe,
  score_bebidas: data.scores.bebidas,
  score_comida: data.scores.comida,
  score_ambiente: data.scores.ambiente,
  score_precios: data.scores.precios,
  score_atencion: data.scores.atencion,
});

const bind = (data: EstablishmentWrite) => ({
  ...bindNotes(data),
  name: data.name,
  type: data.type,
  address: data.address,
  neighborhood: data.neighborhood,
  latitude: data.latitude,
  longitude: data.longitude,
  visit_status: data.visitStatus,
  visit_date: data.visitDate,
  description: data.description,
  in_passport: Number(data.inPassport),
  offers_drinks: Number(data.offersDrinks),
  offers_food: Number(data.offersFood),
  offers_desserts: Number(data.offersDesserts),
  offers_sugar_free: Number(data.offersSugarFree),
  offers_board_games: Number(data.offersBoardGames),
  offers_seasonal_drinks: Number(data.offersSeasonalDrinks),
  google_maps_url: data.googleMapsUrl,
  google_place_id: data.googlePlaceId,
});

export const establishmentModel = {
  findAll(): EstablishmentRow[] {
    return getDb().prepare('SELECT * FROM establishments').all() as EstablishmentRow[];
  },

  findById(id: number): EstablishmentRow | undefined {
    return getDb().prepare('SELECT * FROM establishments WHERE id = ?').get(id) as
      | EstablishmentRow
      | undefined;
  },

  insert(data: EstablishmentWrite): number {
    const now = nowIso();
    const result = getDb()
      .prepare(
        `INSERT INTO establishments
           (name, type, address, neighborhood, latitude, longitude, visit_status, visit_date,
            description, in_passport, offers_drinks, offers_food, offers_desserts, offers_sugar_free,
            offers_board_games, offers_seasonal_drinks,
            google_maps_url, google_place_id, observations, consumed_drink, consumed_food, consumed_dessert,
            answers, score_cafe, score_bebidas, score_comida, score_ambiente,
            score_precios, score_atencion, is_demo, created_at, updated_at)
         VALUES
           (@name, @type, @address, @neighborhood, @latitude, @longitude, @visit_status, @visit_date,
            @description, @in_passport, @offers_drinks, @offers_food, @offers_desserts, @offers_sugar_free,
            @offers_board_games, @offers_seasonal_drinks,
            @google_maps_url, @google_place_id, @observations, @consumed_drink, @consumed_food, @consumed_dessert,
            @answers, @score_cafe, @score_bebidas, @score_comida, @score_ambiente,
            @score_precios, @score_atencion, @is_demo, @created_at, @updated_at)`,
      )
      .run({ ...bind(data), is_demo: Number(data.isDemo ?? false), created_at: now, updated_at: now });
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: EstablishmentWrite): void {
    getDb()
      .prepare(
        `UPDATE establishments SET
           name = @name, type = @type, address = @address, neighborhood = @neighborhood,
           latitude = @latitude, longitude = @longitude, visit_status = @visit_status,
           visit_date = @visit_date, description = @description, in_passport = @in_passport,
           offers_drinks = @offers_drinks, offers_food = @offers_food,
           offers_desserts = @offers_desserts, offers_sugar_free = @offers_sugar_free,
           offers_board_games = @offers_board_games, offers_seasonal_drinks = @offers_seasonal_drinks,
           google_maps_url = @google_maps_url, google_place_id = @google_place_id,
           observations = @observations, consumed_drink = @consumed_drink, consumed_food = @consumed_food,
           consumed_dessert = @consumed_dessert, answers = @answers, score_cafe = @score_cafe,
           score_bebidas = @score_bebidas, score_comida = @score_comida,
           score_ambiente = @score_ambiente, score_precios = @score_precios,
           score_atencion = @score_atencion, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run({ ...bind(data), id, updated_at: nowIso() });
  },

  updateNotes(id: number, data: NotesWrite): void {
    getDb()
      .prepare(
        `UPDATE establishments SET observations = @observations, consumed_drink = @consumed_drink,
           consumed_food = @consumed_food, consumed_dessert = @consumed_dessert, answers = @answers, score_cafe = @score_cafe,
           score_bebidas = @score_bebidas, score_comida = @score_comida,
           score_ambiente = @score_ambiente, score_precios = @score_precios, score_atencion = @score_atencion,
           updated_at = @updated_at WHERE id = @id`,
      )
      .run({ ...bindNotes(data), id, updated_at: nowIso() });
  },

  updateVisit(id: number, status: VisitStatus, date: string | null): void {
    getDb()
      .prepare('UPDATE establishments SET visit_status = ?, visit_date = ?, updated_at = ? WHERE id = ?')
      .run(status, date, nowIso(), id);
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM establishments WHERE id = ?').run(id);
  },

  findDemoIds(): number[] {
    return (getDb().prepare('SELECT id FROM establishments WHERE is_demo = 1').all() as { id: number }[]).map(
      (row) => row.id,
    );
  },
};

export const ratingModel = {
  findAll(): RatingRow[] {
    return getDb().prepare('SELECT * FROM ratings').all() as RatingRow[];
  },

  findByEstablishment(id: number): RatingRow[] {
    return getDb().prepare('SELECT * FROM ratings WHERE establishment_id = ?').all(id) as RatingRow[];
  },

  /** Reemplaza todas las calificaciones; las categorías que ya no aplican desaparecen. */
  replace(id: number, ratings: Partial<Record<Category, RatingWrite>>): void {
    const db = getDb();
    db.prepare('DELETE FROM ratings WHERE establishment_id = ?').run(id);
    const insert = db.prepare(
      'INSERT INTO ratings (establishment_id, category, score, comment, highlights) VALUES (?, ?, ?, ?, ?)',
    );
    for (const [category, rating] of Object.entries(ratings)) {
      if (rating) insert.run(id, category, rating.score, rating.comment, rating.highlights);
    }
  },
};
