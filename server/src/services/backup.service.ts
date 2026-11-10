import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { closeDatabase, getDb, openDatabase } from '../db/connection.js';
import { LATEST_SCHEMA_VERSION } from '../db/migrations.js';
import { HttpError, notFound } from '../errors.js';

const APP_ID = 'los-amigos-del-kaffe';
const DB_ENTRY = 'kaffe.db';
const MANIFEST_ENTRY = 'manifest.json';
const UPLOADS_PREFIX = 'uploads/';
const VALID_NAME = /^[\w.-]+\.zip$/;

export interface BackupInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function uniquePath(label: string): string {
  const base = `kaffe-${label}-${timestamp()}`;
  let candidate = path.join(config.paths.backups, `${base}.zip`);
  for (let n = 2; fs.existsSync(candidate); n += 1) {
    candidate = path.join(config.paths.backups, `${base}-${n}.zip`);
  }
  return candidate;
}

export function resolveBackup(name: string): string {
  if (!VALID_NAME.test(name)) throw notFound('Respaldo');
  const file = path.join(config.paths.backups, name);
  if (!fs.existsSync(file)) throw notFound('Respaldo');
  return file;
}

export function listBackups(): BackupInfo[] {
  fs.mkdirSync(config.paths.backups, { recursive: true });
  return fs
    .readdirSync(config.paths.backups)
    .filter((name) => VALID_NAME.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(config.paths.backups, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Copia coherente de la base (VACUUM INTO respeta el WAL) más todas las fotografías. */
export function createBackup(label = 'respaldo'): BackupInfo {
  fs.mkdirSync(config.paths.temp, { recursive: true });
  fs.mkdirSync(config.paths.backups, { recursive: true });
  const snapshot = path.join(config.paths.temp, `snapshot-${Date.now()}.db`);
  try {
    const db = getDb();
    db.prepare('VACUUM INTO ?').run(snapshot);
    const zip = new AdmZip();
    zip.addLocalFile(snapshot, '', DB_ENTRY);
    if (fs.existsSync(config.paths.uploads)) zip.addLocalFolder(config.paths.uploads, 'uploads');

    const count = (table: string) =>
      (db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
    const manifest = {
      app: APP_ID,
      schemaVersion: LATEST_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      counts: {
        establishments: count('establishments'),
        ratings: count('ratings'),
        reviews: count('reviews'),
        photos: count('photos'),
        availability: count('availability_items'),
        seasonal: count('seasonal_products'),
      },
    };
    zip.addFile(MANIFEST_ENTRY, Buffer.from(JSON.stringify(manifest, null, 2)));

    const destination = uniquePath(label);
    zip.writeZip(destination);
    const stat = fs.statSync(destination);
    return { name: path.basename(destination), sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
  } finally {
    fs.rmSync(snapshot, { force: true });
  }
}

export function deleteBackup(name: string): void {
  fs.rmSync(resolveBackup(name));
}

const invalid = (detail: string) => new HttpError(400, `El archivo no es un respaldo válido: ${detail}`);

/** Solo se aceptan las entradas esperadas: evita escribir fuera de la carpeta de datos. */
function isAllowedEntry(name: string): boolean {
  if (name === DB_ENTRY || name === MANIFEST_ENTRY) return true;
  if (!name.startsWith(UPLOADS_PREFIX) || name.includes('\\')) return false;
  const parts = name.split('/');
  if (parts.includes('..') || parts.includes('.')) return false;
  return (
    name === UPLOADS_PREFIX ||
    /^uploads\/(establishments|reviews|seasonal)\/$/.test(name) ||
    /^uploads\/(establishments|reviews|seasonal)\/[\w.-]+\.webp$/.test(name)
  );
}

function readArchive(zipPath: string): AdmZip {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch {
    throw invalid('no se pudo abrir el ZIP.');
  }
  const entries = zip.getEntries();
  const unexpected = entries.find((entry) => !isAllowedEntry(entry.entryName));
  if (unexpected) throw invalid(`contiene un archivo inesperado (${unexpected.entryName}).`);

  const manifest = zip.getEntry(MANIFEST_ENTRY);
  if (!manifest || !zip.getEntry(DB_ENTRY)) throw invalid('le falta la base de datos o el manifiesto.');
  let parsed: { app?: unknown; schemaVersion?: unknown };
  try {
    parsed = JSON.parse(manifest.getData().toString('utf8'));
  } catch {
    throw invalid('el manifiesto está dañado.');
  }
  if (parsed.app !== APP_ID) throw invalid('no pertenece a Los Amigos del Kaffe.');
  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > LATEST_SCHEMA_VERSION) {
    throw invalid('fue creado por una versión más nueva de la aplicación.');
  }
  return zip;
}

function verifyDatabase(file: string): void {
  let probe: Database.Database | null = null;
  try {
    probe = new Database(file, { readonly: true });
    const result = probe.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw new Error(String(result));
    probe.prepare('SELECT COUNT(*) FROM establishments').get();
  } catch {
    throw invalid('la base de datos está dañada.');
  } finally {
    probe?.close();
  }
}

/**
 * Restaura un respaldo sin riesgo de quedarse a medias: valida todo en una carpeta temporal,
 * guarda un respaldo de seguridad del estado actual, y si el reemplazo falla vuelve atrás.
 */
export function restoreFromZip(zipPath: string): { safetyBackup: string } {
  const zip = readArchive(zipPath);
  fs.mkdirSync(config.paths.temp, { recursive: true });
  const staging = fs.mkdtempSync(path.join(config.paths.temp, 'restore-'));
  const previous = fs.mkdtempSync(path.join(config.paths.temp, 'previous-'));
  const { database, uploads } = config.paths;
  const moved: [string, string][] = [];

  try {
    zip.extractAllTo(staging, true);
    verifyDatabase(path.join(staging, DB_ENTRY));
    const safety = createBackup('antes-de-restaurar');

    closeDatabase();
    try {
      for (const file of [database, `${database}-wal`, `${database}-shm`, uploads]) {
        if (!fs.existsSync(file)) continue;
        const target = path.join(previous, path.basename(file));
        fs.renameSync(file, target);
        moved.push([target, file]);
      }
      fs.renameSync(path.join(staging, DB_ENTRY), database);
      const stagedUploads = path.join(staging, 'uploads');
      if (fs.existsSync(stagedUploads)) fs.renameSync(stagedUploads, uploads);
      else fs.mkdirSync(uploads, { recursive: true });
      openDatabase(); // Aplica migraciones si el respaldo es de una versión anterior.
    } catch (error) {
      closeDatabase();
      fs.rmSync(database, { force: true });
      fs.rmSync(uploads, { recursive: true, force: true });
      for (const [from, to] of moved) fs.renameSync(from, to);
      openDatabase();
      throw error;
    }
    return { safetyBackup: safety.name };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(previous, { recursive: true, force: true });
  }
}
