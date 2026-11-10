import { getDb } from '../db/connection.js';
import { nowIso } from '../utils.js';

export interface ReviewRow {
  id: number;
  establishment_id: number;
  friend_id: number;
  friend_name: string;
  score: number | null;
  comment: string;
  ordered: string;
  answers: string;
  visit_date: string | null;
  photo_filename: string | null;
  photo_thumb_filename: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWrite {
  friendId: number;
  score: number | null;
  comment: string;
  ordered: string;
  answers: string;
  visitDate: string | null;
  photoFilename: string | null;
  photoThumbFilename: string | null;
}

const SELECT = `SELECT r.*, f.name AS friend_name FROM reviews r JOIN friends f ON f.id = r.friend_id`;

export const reviewModel = {
  findAll(): ReviewRow[] {
    return getDb().prepare(SELECT).all() as ReviewRow[];
  },

  findByEstablishment(id: number): ReviewRow[] {
    return getDb()
      .prepare(`${SELECT} WHERE r.establishment_id = ? ORDER BY r.created_at DESC, r.id DESC`)
      .all(id) as ReviewRow[];
  },

  findByFriend(friendId: number): ReviewRow[] {
    return getDb()
      .prepare(`${SELECT} WHERE r.friend_id = ? ORDER BY r.created_at DESC, r.id DESC`)
      .all(friendId) as ReviewRow[];
  },

  findById(id: number): ReviewRow | undefined {
    return getDb().prepare(`${SELECT} WHERE r.id = ?`).get(id) as ReviewRow | undefined;
  },

  insert(establishmentId: number, data: ReviewWrite): number {
    const now = nowIso();
    const result = getDb()
      .prepare(
        `INSERT INTO reviews (establishment_id, friend_id, score, comment, ordered, answers, visit_date,
                              photo_filename, photo_thumb_filename, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        establishmentId,
        data.friendId,
        data.score,
        data.comment,
        data.ordered,
        data.answers,
        data.visitDate,
        data.photoFilename,
        data.photoThumbFilename,
        now,
        now,
      );
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: ReviewWrite): void {
    getDb()
      .prepare(
        `UPDATE reviews SET friend_id = ?, score = ?, comment = ?, ordered = ?, answers = ?, visit_date = ?,
                photo_filename = ?, photo_thumb_filename = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        data.friendId,
        data.score,
        data.comment,
        data.ordered,
        data.answers,
        data.visitDate,
        data.photoFilename,
        data.photoThumbFilename,
        nowIso(),
        id,
      );
  },

  delete(id: number): void {
    getDb().prepare('DELETE FROM reviews WHERE id = ?').run(id);
  },
};

export interface FriendRow {
  id: number;
  name: string;
}

export interface FriendSummaryRow extends FriendRow {
  review_count: number;
  average_score: number | null;
}

export const friendModel = {
  findAll(): FriendSummaryRow[] {
    return getDb()
      .prepare(
        `SELECT f.id, f.name, COUNT(r.id) AS review_count, AVG(r.score) AS average_score
         FROM friends f JOIN reviews r ON r.friend_id = f.id
         GROUP BY f.id ORDER BY f.name COLLATE NOCASE`,
      )
      .all() as FriendSummaryRow[];
  },

  findById(id: number): FriendRow | undefined {
    return getDb().prepare('SELECT id, name FROM friends WHERE id = ?').get(id) as FriendRow | undefined;
  },

  /** Busca al amigo sin distinguir mayúsculas; si no existe lo crea. */
  findOrCreate(name: string): number {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM friends WHERE name = ?').get(name) as { id: number } | undefined;
    if (existing) return existing.id;
    return Number(db.prepare('INSERT INTO friends (name) VALUES (?)').run(name).lastInsertRowid);
  },

  /** Quita a los amigos que se quedaron sin opiniones. */
  deleteOrphans(): void {
    getDb().prepare('DELETE FROM friends WHERE id NOT IN (SELECT friend_id FROM reviews)').run();
  },
};
