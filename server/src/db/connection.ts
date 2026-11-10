import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { LATEST_SCHEMA_VERSION, migrations } from './migrations.js';

let db: Database.Database | null = null;

export function ensureDataDirectories(): void {
  const { data, backups, temp, uploads } = config.paths;
  for (const dir of [data, backups, temp, uploads]) fs.mkdirSync(dir, { recursive: true });
}

/** Abre la base de datos y aplica las migraciones pendientes, cada una en su transacción. */
export function openDatabase(): Database.Database {
  if (db) return db;
  ensureDataDirectories();
  const connection = new Database(config.paths.database);
  connection.pragma('journal_mode = WAL');
  connection.pragma('synchronous = FULL');
  connection.pragma('foreign_keys = ON');

  const current = connection.pragma('user_version', { simple: true }) as number;
  if (current > LATEST_SCHEMA_VERSION) {
    connection.close();
    throw new Error(
      `La base de datos tiene el esquema v${current}, más nuevo que esta versión de la aplicación (v${LATEST_SCHEMA_VERSION}).`,
    );
  }
  // Si una actualización cambia el esquema, primero queda una copia de la base de datos.
  if (current > 0 && current < LATEST_SCHEMA_VERSION) {
    const copy = path.join(config.paths.backups, `antes-de-migrar-v${current}-${Date.now()}.db`);
    connection.prepare('VACUUM INTO ?').run(copy);
  }
  // Reconstruir una tabla con llaves foráneas activas borraría sus filas hijas en cascada, y este
  // PRAGMA no surte efecto dentro de una transacción. La integridad se comprueba antes de confirmar.
  connection.pragma('foreign_keys = OFF');
  try {
    for (let version = current; version < LATEST_SCHEMA_VERSION; version += 1) {
      connection.transaction(() => {
        connection.exec(migrations[version]!);
        const broken = connection.pragma('foreign_key_check') as unknown[];
        if (broken.length > 0) throw new Error(`La migración ${version + 1} dejó referencias rotas.`);
        connection.pragma(`user_version = ${version + 1}`);
      })();
    }
  } catch (error) {
    connection.close();
    throw error;
  }
  connection.pragma('foreign_keys = ON');
  db = connection;
  return db;
}

export function getDb(): Database.Database {
  return db ?? openDatabase();
}

export function closeDatabase(): void {
  if (!db) return;
  db.close();
  db = null;
}
