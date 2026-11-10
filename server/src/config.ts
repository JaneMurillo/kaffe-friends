import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// server/src o server/dist -> dos niveles arriba está la raíz del proyecto.
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true } as dotenv.DotenvConfigOptions);

const dataDir = path.resolve(ROOT_DIR, process.env.DATA_DIR ?? 'data');

// Corre desde el código TypeScript solo en desarrollo; compilado siempre es .js.
const runningFromSource = import.meta.url.endsWith('.ts');

export const config = {
  port: Number(process.env.PORT ?? 5050),
  host: process.env.HOST ?? '127.0.0.1',
  /** Si tiene valor, toda la aplicación pide esta contraseña. Es obligatoria fuera de 127.0.0.1. */
  accessPassword: process.env.APP_PASSWORD ?? '',
  /** Clave de Places API (New). Vive solo en el servidor; nunca se envía al navegador. */
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  /** En desarrollo, la interfaz llega por el proxy de Vite, que es otro origen. */
  trustedDevOrigins: runningFromSource ? ['localhost:5173', '127.0.0.1:5173'] : [],
  paths: {
    data: dataDir,
    database: path.join(dataDir, 'kaffe.db'),
    uploads: path.join(dataDir, 'uploads'),
    backups: path.join(dataDir, 'backups'),
    temp: path.join(dataDir, '.tmp'),
    clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  },
  uploads: {
    maxFileSizeBytes: 15 * 1024 * 1024,
    maxFilesPerRequest: 20,
    maxPhotoWidth: 2000,
    thumbWidth: 720,
  },
  backups: {
    maxUploadBytes: 4 * 1024 * 1024 * 1024,
  },
} as const;
