/**
 * Configura la clave de Places API sin editar archivos: la pide, la prueba con una búsqueda
 * real en Google y solo la guarda en .env si funciona. Nunca la muestra en pantalla.
 *
 *   npm run google:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { ROOT_DIR } from '../config.js';

const ENV_FILE = path.join(ROOT_DIR, '.env');
const KEY_NAME = 'GOOGLE_MAPS_API_KEY';

type Check = { ok: true; found: string } | { ok: false; message: string };

async function testKey(key: string): Promise<Check> {
  let response: Response;
  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: 'Catedral de Guadalajara', languageCode: 'es', regionCode: 'MX', pageSize: 1 }),
    });
  } catch {
    return { ok: false, message: 'No se pudo conectar con Google. Revisa tu internet e intenta de nuevo.' };
  }

  const body = (await response.json().catch(() => null)) as {
    places?: { displayName?: { text?: string }; formattedAddress?: string }[];
    error?: { message?: string; status?: string };
  } | null;

  if (response.ok) {
    const place = body?.places?.[0];
    return { ok: true, found: [place?.displayName?.text, place?.formattedAddress].filter(Boolean).join(' · ') };
  }

  const detail = body?.error?.message ?? `Error ${response.status}`;
  if (/billing/i.test(detail)) {
    return { ok: false, message: `El proyecto no tiene la facturación activa. Actívala en Google Cloud.\n  (${detail})` };
  }
  if (/not valid|invalid/i.test(detail) && response.status === 400) {
    return { ok: false, message: 'Google no reconoce esa clave. Cópiala de nuevo, completa y sin espacios.' };
  }
  if (response.status === 403) {
    return {
      ok: false,
      message: `Google rechazó la clave. Revisa que "Places API (New)" esté habilitada y que la clave no tenga restricción de sitio web.\n  (${detail})`,
    };
  }
  return { ok: false, message: detail };
}

/** Reemplaza la línea de la clave y conserva el resto de la configuración. */
function saveKey(key: string): void {
  const current = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const lines = current.split(/\r?\n/).filter((line) => !new RegExp(`^\\s*${KEY_NAME}\\s*=`).test(line));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  lines.push(`${KEY_NAME}=${key}`);
  fs.writeFileSync(ENV_FILE, `${lines.join('\n')}\n`);
}

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const key = (await prompt.question('\nPega tu clave de Places API y presiona Enter: ')).trim();
prompt.close();

if (!key) {
  console.log('\nNo escribiste ninguna clave. No se cambió nada.');
  process.exit(1);
}
if (/\s/.test(key)) {
  console.log('\nLa clave no debe tener espacios. No se cambió nada.');
  process.exit(1);
}

console.log('\nProbando la clave con Google...');
const result = await testKey(key);
if (!result.ok) {
  console.log(`\nNo funcionó, así que no se guardó:\n  ${result.message}`);
  process.exit(1);
}

saveKey(key);
console.log(`\nFunciona. Google respondió: ${result.found || 'correcto'}`);
console.log('La clave quedó guardada en .env, que no se sube a Git.');
console.log('Cierra la aplicación si está abierta y vuelve a abrir iniciar.bat.');
