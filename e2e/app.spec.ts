/**
 * Recorre la aplicación real en un navegador, con el servidor compilado y una carpeta de
 * datos temporal: nunca toca tus datos. Requiere "npm run build" previo.
 *
 *   npm run test:e2e
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const here = __dirname;
const tmp = path.join(here, '.tmp');
const dataDir = path.join(tmp, 'data');
const shots = path.join(tmp, 'screenshots');
const PORT = '5051';
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess | null = null;

async function startServer() {
  server = spawn(process.execPath, [path.join(here, '..', 'server', 'dist', 'index.js')], {
    env: { ...process.env, PORT, DATA_DIR: dataDir, HOST: '127.0.0.1', APP_PASSWORD: '', GOOGLE_MAPS_API_KEY: '' },
    stdio: 'inherit',
  });
  await expect
    .poll(() => fetch(`http://127.0.0.1:${PORT}/api/stats`).then((res) => res.status, () => 0), { timeout: 15_000 })
    .toBe(200);
}

async function stopServer() {
  if (!server) return;
  const exited = new Promise((resolve) => server!.once('exit', resolve));
  // En Windows esto termina el proceso de golpe: también comprueba que los datos sobreviven.
  server.kill();
  await exited;
  server = null;
}

/** Imagen sintética para pruebas: no representa a ningún lugar real. */
async function makePhoto(name: string, from: string, to: string, width = 1600, height = 1200) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1600 1200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="1600" height="1200" fill="url(#g)"/><circle cx="800" cy="600" r="300" fill="#fffcf7" opacity=".35"/>
    <circle cx="800" cy="600" r="210" fill="#3b2923" opacity=".55"/></svg>`;
  const file = path.join(tmp, name);
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(file);
  return file;
}

const seen: string[] = [];
function trackBrowserErrors(page: Page) {
  page.on('pageerror', (error) => seen.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Los 4xx de las validaciones son intencionales y el navegador siempre los registra.
    if (message.type() === 'error' && !message.text().includes('status of 4')) seen.push(message.text());
  });
}

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 4).join(' | ')}`,
  );
  expect(summary, `Accesibilidad en ${label}`).toEqual([]);
}

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
}

const pick = (page: Page, group: string, option: string) =>
  page.getByRole('group', { name: group }).getByRole('radio', { name: option, exact: true }).check();

const filter = (page: Page, label: string) =>
  page.locator('label.filter', { has: page.locator('.filter__label', { hasText: new RegExp(`^${label}$`) }) }).locator('select');

const form = {
  name: (page: Page) => page.getByLabel('Nombre de la cafetería'),
  step: (page: Page, label: string) => page.getByRole('navigation', { name: 'Pasos del formulario' }).getByRole('button', { name: label }).click(),
  scoreIn: (page: Page, aspect: string, value: string) =>
    page
      .getByRole('group', { name: aspect, exact: true })
      .locator('.score-input__option', { hasText: new RegExp(`^${value}$`) })
      .click(),
};

const general = (page: Page) => page.locator('.score-board__value');

/** Elige una respuesta rápida del cuestionario. */
const answer = (scope: Page | ReturnType<Page['getByRole']>, question: string, option: string) =>
  scope.getByRole('group', { name: new RegExp(question) }).locator('.quick__option', { hasText: option }).click();

const placeBody = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: 'cafeteria',
  address: 'Calle de prueba 100',
  neighborhood: 'Americana',
  visitStatus: 'visitado',
  visitDate: '2026-05-01',
  description: '',
  inPassport: false,
  offersDrinks: true,
  offersFood: false,
  offersDesserts: false,
  ratings: {},
  ...extra,
});

async function apiCreate(page: Page, body: unknown) {
  const res = await page.request.post('/api/establishments', { data: body as Record<string, unknown> });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: number };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(shots, { recursive: true });
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
});

test.beforeEach(({ page }) => trackBrowserErrors(page));

test('estados vacíos: la aplicación inicia sin datos inventados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Los Amigos');
  await expect(page.getByText('Un café a la vez.').first()).toBeVisible();
  await expect(page.getByText('La primera taza está por servirse')).toBeVisible();
  await shoot(page, '01-inicio-vacio');
  await axe(page, 'inicio vacío');

  for (const [route, text] of [
    ['/todas', 'Esta mesa sigue libre'],
    ['/top', 'El podio está vacío'],
    ['/pasaporte', 'Tu pasaporte está en blanco'],
    ['/amigos', 'Todavía no hay opiniones'],
    ['/respaldos', 'Aún no hay respaldos'],
  ] as const) {
    await page.goto(route);
    await expect(page.getByText(text)).toBeVisible();
  }
});

test('formulario: por pasos, con enlace de Google Maps, cuestionario y calificaciones', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Agregar cafetería' }).first().click();
  await expect(page).toHaveURL(/agregar/);

  // Solo el nombre es obligatorio. Se puede guardar en cualquier paso.
  await page.getByRole('button', { name: 'Guardar y seguir después' }).click();
  await expect(page.getByRole('alert')).toContainText('Escribe el nombre');
  await expect(page).toHaveURL(/agregar/);

  // Un enlace ajeno se rechaza; uno de Google Maps completa solo lo que trae.
  const link = page.getByLabel('Enlace de Google Maps');
  await link.fill('https://example.com/maps/place/x');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.locator('.maps-import')).toContainText('Pega un enlace de Google Maps');

  const maps =
    'https://www.google.com/maps/place/Caf%C3%A9+Prueba+Uno/@20.67,-103.37,17z/data=!4m6!3m5!8m2!3d20.6736!4d-103.3612';
  await link.fill(maps);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(form.name(page)).toHaveValue('Café Prueba Uno');
  await expect(page.locator('.maps-import__result')).toContainText('nombre, ubicación en el mapa');
  // La dirección no viene en el enlace: se avisa y no se inventa.
  await expect(page.locator('.maps-import__result')).toContainText('no incluye la dirección');
  await expect(page.getByLabel('Dirección')).toHaveValue('');

  // Todo se puede corregir a mano. Comida, postres y sin azúcar son independientes.
  await page.getByLabel('Dirección').fill('Av. de Prueba 123');
  await page.getByLabel('Colonia').fill('Americana');
  await page.getByLabel('Descripción breve').fill('Lugar creado por la prueba automática.');
  await page.locator('.feature', { hasText: 'Comida' }).click();
  await page.locator('.feature', { hasText: 'Bebidas sin azúcar' }).click();
  await page.locator('.feature', { hasText: 'Pasaporte Guadalajara' }).click();
  await page.getByLabel('Fecha de visita').fill('2026-06-15');
  await expect(page.getByRole('group', { name: 'Categoría' }).getByRole('radio')).toHaveCount(2);
  await axe(page, 'formulario: el lugar');

  await page.getByRole('button', { name: 'Siguiente' }).click();
  // Comida se marcó en el paso anterior y postres no: solo se pregunta por lo que hay.
  await expect(page.getByLabel('¿Qué postre probaste?')).toHaveCount(0);
  await page.getByLabel('¿Qué bebida tomaste?').fill('Flat white');
  await page.getByLabel('¿Qué comida probaste?').fill('Molletes');
  await answer(page, 'ambiente', 'Acogedor');
  await answer(page, 'ambiente', 'Tranquilo');
  await answer(page, 'Qué tal estuvieron las bebidas', 'Excelentes');
  await answer(page, 'Cómo estuvieron los precios', 'Razonables');
  await answer(page, 'Qué fue lo que más te gustó', 'La atención');
  // Tocar otra vez una respuesta única la quita.
  await answer(page, 'Qué fue lo que más te gustó', 'La atención');
  await answer(page, 'Qué fue lo que más te gustó', 'El ambiente');
  await answer(page, 'Qué fue lo que más te gustó', 'Las bebidas');
  await answer(page, 'Qué fue lo que más te gustó', 'El café');
  await answer(page, 'Volverías', 'Sí');
  await page.getByLabel('Observaciones personales').fill('Pedir el cortado.');
  await shoot(page, '02-formulario-cuestionario');
  await axe(page, 'formulario: cuestionario');

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await form.scoreIn(page, 'Café', '9');
  await form.scoreIn(page, 'Atención', '8');
  await expect(page.locator('.form-preview')).toContainText('8.5');

  // La ubicación del enlace ya está en el mapa, y se puede afinar.
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByLabel('Latitud')).toHaveValue('20.6736');
  await expect(page.getByLabel('Longitud')).toHaveValue('-103.3612');
  const picker = page.locator('.map--picker .leaflet-container');
  await expect(picker).toBeVisible();
  await expect.poll(() => picker.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  await expect(page.locator('.map--picker .pin')).toHaveCount(1);

  await page.getByRole('button', { name: 'Siguiente' }).click();
  const uno = await makePhoto('uno.jpg', '#76513d', '#b98252');
  const dos = await makePhoto('dos.jpg', '#89917a', '#e7d9c7', 1500, 2200); // Vertical.
  await page.locator('.dropzone input[type=file]').setInputFiles([uno, dos]);
  await expect(page.locator('.gallery--picker .gallery__item')).toHaveCount(2);
  await page.locator('.gallery__main-choice').nth(1).click();
  await axe(page, 'formulario: fotografías');

  await page.getByRole('button', { name: 'Guardar cafetería' }).click();
  await expect(page).toHaveURL(/lugar\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Café Prueba Uno');

  await expect(general(page)).toHaveText('8.5');
  await expect(page.locator('.score-line', { hasText: 'Precios' })).toContainText('—');
  const summary = page.locator('.answer-summary');
  await expect(summary.locator('.answer-summary__row', { hasText: 'Ambiente' })).toContainText('Acogedor');
  await expect(summary.locator('.answer-summary__row', { hasText: 'Bebidas' })).toContainText('Excelentes');
  await expect(summary.locator('.answer-summary__row', { hasText: 'Lo mejor' })).toContainText('El café');
  await expect(summary).not.toContainText('temporada');
  await expect(summary).not.toContainText('especiales');
  await expect(page.getByText('Pedir el cortado.')).toBeVisible();
  await expect(page.locator('.consumed')).toContainText('Flat white');
  await expect(page.locator('.consumed')).toContainText('Molletes');
  await expect(page.locator('.consumed__item')).toHaveCount(2);
  await expect(page.getByRole('img', { name: /Pasaporte Guadalajara: visitado/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir en Google Maps' })).toHaveAttribute('href', maps);

  // Fotografías: guardadas, con la principal elegida, y se amplían.
  await expect(page.locator('.gallery__item')).toHaveCount(2);
  await expect(page.locator('.gallery__badge')).toHaveCount(1);
  await page.getByRole('button', { name: /Ampliar fotografía 1/ }).click();
  await expect(page.locator('.lightbox__image')).toBeVisible();
  const natural = await page.locator('.lightbox__image').evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(natural).toBeGreaterThan(1000);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.lightbox__count')).toHaveText('2 de 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox__image')).toHaveCount(0);

  // Mapa individual del perfil.
  await expect(page.locator('.map--detail .pin')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  await shoot(page, '03-ficha');
  await axe(page, 'ficha');

  // Las fotografías de la ficha se ven grandes.
  const large = (await page.locator('#fotografias .gallery__item').first().boundingBox())!;
  expect(large.width).toBeGreaterThan(500);
  expect(large.height).toBeGreaterThan(400);

  // Con un solo lugar, su tarjeta de "Últimos agregados" conserva un tamaño normal.
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(1);
  const card = (await page.locator('.card').boundingBox())!;
  expect(card.width).toBeLessThan(400);
  expect(card.height).toBeLessThan(560);
});

test('guardar a medias: solo con el nombre, y continuar después', async ({ page }) => {
  await page.goto('/agregar');
  await form.name(page).fill('Borrador Prueba');
  await page.getByRole('button', { name: 'Guardar y seguir después' }).click();
  await expect(page).toHaveURL(/lugar\/\d+$/);

  // Sin inventar datos: dice lo que falta y lleva a completarlo.
  await expect(page.locator('.sheet-hero__todo')).toContainText('dirección');
  await expect(page.locator('.sheet-hero__meta').first()).not.toContainText(',');
  await expect(page.getByRole('heading', { name: 'Disponibilidad' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Productos de temporada' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir en Google Maps' })).toHaveCount(0);
  await axe(page, 'ficha incompleta');

  await page.locator('.sheet-hero__todo').getByRole('link', { name: 'Continuar' }).click();
  await expect(form.name(page)).toHaveValue('Borrador Prueba');
  await page.getByLabel('Dirección').fill('Calle Después 5');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.sheet-hero__meta').first()).toContainText('Calle Después 5');

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar cafetería' }).click();
  await expect(page).toHaveURL(/todas/);
});

test('filtros, secciones y vistas', async ({ page }) => {
  await apiCreate(page, placeBody('Panadería Prueba', {
    type: 'panaderia',
    neighborhood: 'Santa Tere',
    latitude: 20.68,
    longitude: -103.36,
    offersDrinks: false,
    offersDesserts: true,
    ratings: { postres: { score: 6 } },
  }));
  await apiCreate(page, placeBody('Casa Mixta Prueba', {
    type: 'cafeteria',
    neighborhood: 'Providencia',
    latitude: 20.69,
    longitude: -103.39,
    offersFood: true,
    offersDesserts: true,
    offersSugarFree: true,
    offersBoardGames: true,
    ratings: { bebidas: { score: 10 } },
  }));
  await apiCreate(page, placeBody('Pendiente Prueba', {
    visitStatus: 'pendiente',
    visitDate: null,
    inPassport: true,
    neighborhood: 'Santa Tere',
    offersBoardGames: true,
    offersSeasonalDrinks: true,
  }));

  const titles = (page: Page) => page.locator('.card__title, .row__title');

  await page.goto('/todas');
  await expect(titles(page)).toHaveCount(4);
  await shoot(page, '04-todas');
  await axe(page, 'todas');

  await page.getByLabel('Buscar por nombre').fill('panaderia');
  await expect(titles(page)).toHaveText(['Panadería Prueba']);
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await expect(titles(page)).toHaveCount(4);

  await expect(filter(page, 'Colonia')).toHaveCount(0);
  await filter(page, 'Calificación').selectOption('8');
  await expect(titles(page)).toHaveCount(2);
  await filter(page, 'Calificación').selectOption('sin');
  await expect(titles(page)).toHaveText(['Pendiente Prueba']);
  await filter(page, 'Calificación').selectOption('');
  await filter(page, 'Pasaporte').selectOption('true');
  await expect(titles(page)).toHaveCount(2);
  await filter(page, 'Pasaporte').selectOption('');
  await filter(page, 'Postres').selectOption('true');
  await expect(titles(page)).toHaveCount(2);
  await filter(page, 'Postres').selectOption('');
  await filter(page, 'Comida').selectOption('true');
  await expect(titles(page)).toHaveCount(2);
  await filter(page, 'Comida').selectOption('');

  await page.getByLabel('Ordenar por').selectOption('score-desc');
  await expect(titles(page).first()).toHaveText('Casa Mixta Prueba');
  await page.getByLabel('Ordenar por').selectOption('name-asc');
  await expect(titles(page).first()).toHaveText('Café Prueba Uno');
  await page.getByLabel('Ordenar por').selectOption('visitDate-desc');
  await expect(titles(page).first()).toHaveText('Café Prueba Uno');

  await page.getByRole('button', { name: 'Vista de lista' }).click();
  await expect(page.locator('.row')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.row')).toHaveCount(4); // La preferencia se recuerda.
  await page.getByRole('button', { name: 'Vista de tarjetas' }).click();

  await page.goto('/solo-cafeterias');
  await expect(titles(page)).toHaveCount(3);
  await expect(page.locator('.card__title', { hasText: 'Panadería Prueba' })).toHaveCount(0);
  await page.goto('/solo-panaderias');
  await expect(titles(page)).toHaveCount(1);

  // "Con comida" dejó de ser una sección: es un filtro, y los enlaces guardados llevan a él.
  await expect(page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: /con comida/i })).toHaveCount(0);
  await page.goto('/con-comida');
  await expect(page).toHaveURL(/todas\?food=true/);
  await expect(titles(page)).toHaveCount(2);

  // Extras: se pueden marcar varios; aparecen los lugares que cumplen con todos.
  await page.goto('/todas');
  await expect(filter(page, 'Bebidas sin azúcar')).toHaveCount(0);
  const extras = page.getByRole('group', { name: 'Extras' });
  await extras.getByLabel('Con bebidas sin azúcar').check();
  await expect(titles(page)).toHaveText(['Casa Mixta Prueba', 'Café Prueba Uno']);
  await extras.getByLabel('Con juegos de mesa').check();
  await expect(titles(page)).toHaveText(['Casa Mixta Prueba']);
  await expect(page.locator('.browser__filters-toggle')).toHaveText('Filtros (2)'); // En escritorio el botón se oculta.
  await extras.getByLabel('Con bebidas sin azúcar').uncheck();
  await extras.getByLabel('Con bebidas de temporada').check();
  await expect(titles(page)).toHaveText(['Pendiente Prueba']);
  await expect(page).toHaveURL(/boardGames=true/);
  await expect(page).toHaveURL(/seasonalDrinks=true/);
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await expect(extras.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(titles(page)).toHaveCount(4);
});

test('opiniones: separadas de mi calificación y del Top', async ({ page }) => {
  await page.goto('/top');
  const order = () => page.locator('.ranking__name').allTextContents();
  await expect(page.locator('.ranking__name')).toHaveCount(3);
  const topBefore = await order();
  expect(topBefore).toEqual(['Casa Mixta Prueba', 'Café Prueba Uno', 'Panadería Prueba']);
  await shoot(page, '05-top');
  await axe(page, 'top');

  await page.locator('.ranking__name', { hasText: 'Panadería Prueba' }).getByRole('link').click();
  await expect(page.getByText('¿Fuiste con alguien?')).toBeVisible();

  const addReview = async (name: string, score: string, comment: string, photo?: string) => {
    await page.getByRole('button', { name: 'Agregar opinión' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre o apodo').fill(name);
    if (score) await dialog.locator('.score-input__option', { hasText: new RegExp(`^${score}$`) }).click();
    if (comment) await dialog.getByLabel('Comentario adicional (opcional)').fill(comment);
    if (photo) await dialog.locator('input[type=file]').setInputFiles(photo);
    await dialog.getByRole('button', { name: 'Guardar opinión' }).click();
    await expect(dialog).toHaveCount(0);
  };

  // Diálogo: no acepta una opinión sin nada.
  await page.getByRole('button', { name: 'Agregar opinión' }).click();
  await page.getByRole('dialog').getByLabel('Nombre o apodo').fill('Vacía');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar opinión' }).click();
  await expect(page.getByRole('dialog').getByText('Responde alguna pregunta, o agrega')).toBeVisible();
  await axe(page, 'diálogo de opinión');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

  const photo = await makePhoto('opinion.jpg', '#b98252', '#3b2923');
  await addReview('Ana Prueba', '10', 'Excelente pan.', photo);
  await addReview('Luis Prueba', '8', 'Muy rico.');
  await addReview('Eva Prueba', '', 'Sin nota, solo comentario.');

  // Con opciones rápidas basta: no hace falta escribir.
  await page.getByRole('button', { name: 'Agregar opinión' }).click();
  const quick = page.getByRole('dialog');
  await quick.getByLabel('Nombre o apodo').fill('Rápido Prueba');
  await quick.getByLabel('¿Qué pidió de comer o beber?').fill('Latte y rol de canela');
  await answer(quick, 'Qué tal estuvieron las bebidas', 'No lo probé');
  await answer(quick, 'Volverías', 'Tal vez');
  await quick.getByRole('button', { name: 'Guardar opinión' }).click();
  await expect(quick).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Respuestas de Rápido Prueba' })).toContainText('No probé las bebidas');
  await expect(page.locator('.review', { hasText: 'Rápido Prueba' }).locator('.review__ordered')).toContainText('Latte y rol de canela');
  await expect(page.locator('.review', { hasText: 'Rápido Prueba' })).toContainText('Opinión de amigo');
  await page.getByRole('button', { name: 'Eliminar la opinión de Rápido Prueba' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar opinión' }).click();
  await expect(page.locator('.review')).toHaveCount(3);

  // Mi 6; amigos (10 + 8) / 2 = 9; comunitaria (6 + 10 + 8) / 3 = 8. La de Eva no cuenta.
  const scores = page.locator('.friend-scores');
  await expect(general(page)).toHaveText('6.0');
  await expect(scores.getByRole('img', { name: 'Promedio de amigos: 9.0 de 10' })).toBeVisible();
  await expect(scores.getByRole('img', { name: 'Calificación comunitaria: 8.0 de 10' })).toBeVisible();
  await expect(page.locator('.review')).toHaveCount(3);
  await shoot(page, '06-opiniones');
  await axe(page, 'perfil con opiniones');

  // Editar y eliminar opinión, con confirmación.
  await page.getByRole('button', { name: 'Editar la opinión de Luis Prueba' }).click();
  await page.getByRole('dialog').locator('.score-input__option', { hasText: /^4$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar opinión' }).click();
  await expect(scores.getByRole('img', { name: 'Promedio de amigos: 7.0 de 10' })).toBeVisible();

  await page.getByRole('button', { name: 'Eliminar la opinión de Eva Prueba' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.review')).toHaveCount(3);
  await page.getByRole('button', { name: 'Eliminar la opinión de Eva Prueba' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar opinión' }).click();
  await expect(page.locator('.review')).toHaveCount(2);

  // El Top personal no cambió; el comunitario es independiente.
  await page.goto('/top');
  await expect(page.locator('.ranking__name')).toHaveCount(3);
  expect(await order()).toEqual(topBefore);
  await page.getByRole('button', { name: 'De mayor a menor' }).click();
  await expect(page.locator('.ranking__name').first()).toHaveText('Panadería Prueba');
  await page.getByRole('button', { name: 'De menor a mayor' }).click();

  await page.getByRole('button', { name: 'Comunitario' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ranking comunitario');
  // Panadería: (6 + 10 + 4) / 3 = 6.67 sigue siendo la última, pero ya con amigos.
  await expect(page.getByRole('img', { name: 'Calificación comunitaria: 6.7 de 10' })).toBeVisible();

  // Historial por amigo.
  await page.goto('/amigos');
  await shoot(page, '07-amigos');
  await axe(page, 'amigos');
  await page.getByRole('link', { name: 'Ana Prueba' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ana Prueba');
  await expect(page.getByRole('link', { name: 'Panadería Prueba' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Calificación de Ana Prueba: 10.0 de 10' })).toBeVisible();
  await axe(page, 'historial de amigo');
});

test('pasaporte: progreso automático', async ({ page }) => {
  await page.goto('/pasaporte');
  await expect(page.locator('.passport-card')).toHaveCount(2);
  await expect(page.locator('.passport-summary__percent')).toHaveText('50%');
  // Una foto vertical no debe deformar su tarjeta respecto a una sin foto.
  const heights = await page.locator('.passport-card__media').evaluateAll((items) => items.map((item) => item.clientHeight));
  expect(heights[0]).toBe(heights[1]);
  await shoot(page, '08-pasaporte');
  await axe(page, 'pasaporte');

  await page.getByRole('button', { name: 'Pendientes' }).click();
  await expect(page.locator('.passport-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Marcar visitado' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Marcar como visitado' }).click();
  await expect(page.locator('.passport-summary__percent')).toHaveText('100%');

  await page.getByRole('button', { name: 'Todos' }).click();
  await page.locator('.passport-card', { hasText: 'Pendiente Prueba' }).getByRole('button', { name: 'Volver a pendiente' }).click();
  await expect(page.locator('.passport-summary__percent')).toHaveText('50%');

  // Un lugar calificado no puede volver a pendiente sin perder sus notas: se explica.
  await page.locator('.passport-card', { hasText: 'Café Prueba Uno' }).getByRole('button', { name: 'Volver a pendiente' }).click();
  await expect(page.locator('.toast--error')).toContainText('ya tiene calificaciones');
  await expect(page.locator('.passport-summary__percent')).toHaveText('50%');
});

test('mapa: marcadores reales, ventana emergente y filtros', async ({ page }) => {
  const tiles: number[] = [];
  page.on('response', (response) => {
    if (response.url().includes('tile.openstreetmap.org')) tiles.push(response.status());
  });
  await page.goto('/mapa');
  await expect(page.locator('.map--page .pin')).toHaveCount(3);
  await expect(page.getByText('3 lugares en el mapa')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pendiente Prueba' })).toBeVisible(); // Sin ubicación.
  await expect.poll(() => tiles.filter((status) => status === 200).length).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Colaboradores de OpenStreetMap' })).toBeVisible();
  await page.waitForTimeout(800);
  await shoot(page, '09-mapa');
  await axe(page, 'mapa');

  await page.getByRole('button', { name: 'Panadería Prueba' }).click();
  const popup = page.locator('.map-popup');
  await expect(popup.locator('.map-popup__name')).toHaveText('Panadería Prueba');
  await expect(popup).toContainText('Calle de prueba 100');
  await expect(popup).toContainText('Panadería');
  await expect(popup.getByRole('img', { name: /6.0 de 10/ })).toBeVisible();
  await popup.getByRole('link', { name: 'Ver perfil completo' }).click();
  await expect(page).toHaveURL(/lugar\/\d+$/);

  await page.goto('/mapa');
  await filter(page, 'Tipo').selectOption('panaderia');
  await expect(page.locator('.map--page .pin')).toHaveCount(1);
  await filter(page, 'Tipo').selectOption('');
  await expect(filter(page, 'Colonia')).toHaveCount(0);
  await filter(page, 'Calificación').selectOption('9');
  await expect(page.locator('.map--page .pin')).toHaveCount(1);
  await filter(page, 'Calificación').selectOption('');
  await filter(page, 'Pasaporte Guadalajara').selectOption('true');
  await expect(page.locator('.map--page .pin')).toHaveCount(1);
});

test('editar y eliminar', async ({ page }) => {
  await page.goto('/todas');
  await page.getByRole('link', { name: 'Casa Mixta Prueba' }).click();
  await page.getByRole('link', { name: 'Editar', exact: true }).click();
  await expect(form.name(page)).toHaveValue('Casa Mixta Prueba');

  await form.name(page).fill('Casa Mixta Editada');
  // Volver a pendiente borrará sus calificaciones: se avisa antes de guardar.
  await pick(page, 'Visita', 'Pendiente');
  await form.step(page, 'Calificaciones');
  await expect(page.locator('.form-warning')).toContainText('bebidas');
  await form.step(page, 'El lugar');
  await pick(page, 'Visita', 'Ya fui');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Casa Mixta Editada');
  // Editar sin tocar nada conserva las calificaciones anteriores y las muestra.
  await expect(general(page)).toHaveText('10.0');
  await expect(page.locator('.sheet__note')).toContainText('notas anteriores');
  await page.locator('.legacy-notes summary').click();
  await expect(page.locator('.legacy-notes__list')).toContainText('Bebidas: 10');

  // Se cancela la eliminación y el lugar sigue ahí.
  await page.getByRole('button', { name: 'Eliminar' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Casa Mixta Editada');

  await page.getByRole('button', { name: 'Eliminar' }).first().click();
  await axe(page, 'confirmación de eliminar');
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar cafetería' }).click();
  await expect(page).toHaveURL(/todas/);
  await expect(page.locator('.card__title')).toHaveCount(3);
});

test('ficha: orden editorial, notas, disponibilidad y temporada', async ({ page }) => {
  await page.goto('/todas');
  await page.getByRole('link', { name: 'Café Prueba Uno' }).click();

  const titles = () => page.locator('.sheet__title').allTextContents();
  await expect(page.locator('.sheet__title').first()).toBeVisible();
  // Sin datos, Disponibilidad y Productos de temporada no aparecen.
  expect((await titles()).map((title) => title.replace(/^\d+/, ''))).toEqual([
    'Calificaciones',
    'Fotografías',
    'Mis notas',
    'Opiniones de amigos',
    'Ubicación',
  ]);

  // En computadora, información y fotografía van lado a lado, con la foto a la derecha.
  const copy = (await page.locator('.sheet-hero__copy').boundingBox())!;
  const figure = (await page.locator('.sheet-hero__figure').boundingBox())!;
  expect(figure.x).toBeGreaterThan(copy.x + copy.width - 1);

  // Editar mis notas.
  await page.getByRole('button', { name: 'Editar mis notas' }).click();
  const notes = page.getByRole('dialog');
  await expect(notes.getByLabel('¿Qué bebida tomaste?')).toHaveValue('Flat white');
  await expect(notes.getByLabel('¿Qué postre probaste?')).toHaveCount(0);
  await notes.getByLabel('¿Qué comida probaste?').fill('Chilaquiles');
  await answer(notes, 'Cómo estuvo la atención', 'Excelente');
  await answer(notes, 'Qué tan cómodo', 'Ideal');
  await notes.getByLabel('Observaciones personales').fill('Ideal para una mañana larga.');
  await axe(page, 'diálogo de notas');
  await notes.getByRole('button', { name: 'Guardar mis notas' }).click();
  await expect(notes).toHaveCount(0);
  await expect(page.locator('.answer-summary__row', { hasText: 'Atención' })).toContainText('Excelente');
  await expect(page.locator('.answer-summary__row', { hasText: 'Para trabajar' })).toContainText('Ideal');
  await expect(page.getByText('Ideal para una mañana larga.')).toBeVisible();
  await expect(page.locator('.consumed')).toContainText('Chilaquiles');
  await expect(page.locator('.notes-comments').getByRole('heading', { name: 'Mis comentarios' })).toBeVisible();
  // Orden de Mis notas: tabla, comentarios y lo que consumí.
  const notesOrder = await page.locator('#mis-notas').locator('.answer-summary, .sheet__quote, .consumed').evaluateAll((items) => items.map((item) => item.className));
  expect(notesOrder).toEqual(['answer-summary', 'sheet__quote', 'consumed']);

  // Disponibilidad.
  await page.getByRole('button', { name: 'Agregar a Disponibilidad' }).click();
  const availability = page.getByRole('dialog');
  await availability.getByRole('button', { name: 'Guardar' }).click();
  await expect(availability.getByText('Escribe el nombre del producto.')).toBeVisible();
  await availability.getByLabel('Nombre del producto').fill('Croissants');
  await availability.getByLabel('¿Cuándo suele estar disponible?').fill('Antes de las 11');
  await availability.getByLabel('Descripción o nota').fill('Se terminan temprano.');
  await availability.locator('.feature', { hasText: 'Se termina rápido' }).click();
  await availability.getByRole('button', { name: 'Guardar' }).click();
  await expect(availability).toHaveCount(0);
  const section = page.locator('#disponibilidad');
  await expect(section).toContainText('Croissants');
  await expect(section).toContainText('Antes de las 11');
  await expect(section).toContainText('Se termina rápido');

  // Productos de temporada: varios, con fotografía opcional.
  const addSeasonal = async (name: string, status: string, photo?: string) => {
    await page.getByRole('button', { name: 'Agregar producto de temporada' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre del producto').fill(name);
    await dialog.getByLabel('Fecha en la que lo probé').fill('2026-10-05');
    await pick(page, '¿Sigue disponible?', status);
    await dialog.getByLabel('Descripción o nota personal').fill('Nota de prueba.');
    if (photo) await dialog.locator('input[type=file]').setInputFiles(photo);
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toHaveCount(0);
  };
  await addSeasonal('Rol de calabaza', 'Fue temporal', await makePhoto('temporada.jpg', '#b98252', '#76513d'));
  await addSeasonal('Ponche', 'Todavía disponible');
  const seasonal = page.locator('#temporada');
  await expect(seasonal.locator('.seasonal__item')).toHaveCount(2);
  await expect(seasonal).toContainText('Fue temporal');
  await expect(seasonal).toContainText('Todavía disponible');

  // El orden pedido se mantiene con los apartados nuevos.
  expect((await titles()).map((title) => title.replace(/^\d+/, ''))).toEqual([
    'Calificaciones',
    'Fotografías',
    'Mis notas',
    'Disponibilidad',
    'Productos de temporada',
    'Opiniones de amigos',
    'Ubicación',
  ]);

  // Categoría de las fotografías y filtro.
  await page.getByLabel('Categoría de la fotografía 1').selectOption('postres');
  await expect(page.locator('.toast').last()).toContainText('Categoría actualizada');
  await page.reload();
  await page.getByRole('group', { name: 'Filtrar fotografías' }).getByRole('button', { name: 'Postres' }).click();
  await expect(page.locator('#fotografias .gallery__item')).toHaveCount(1);

  await page.waitForLoadState('networkidle');
  await shoot(page, '15-ficha-completa');
  await axe(page, 'ficha completa');

  // En el teléfono se reorganiza en vertical, sin desbordes.
  await page.setViewportSize({ width: 375, height: 780 });
  await page.waitForTimeout(200);
  const copyMobile = (await page.locator('.sheet-hero__copy').boundingBox())!;
  const figureMobile = (await page.locator('.sheet-hero__figure').boundingBox())!;
  expect(figureMobile.y).toBeGreaterThan(copyMobile.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const mobilePhoto = (await page.locator('#fotografias .gallery__item').first().boundingBox())!;
  expect(mobilePhoto.width).toBeGreaterThan(300);
  await shoot(page, '16-ficha-movil');
  await axe(page, 'ficha en móvil');

  await page.goto(page.url() + '/editar');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.waitForLoadState('networkidle');
  const formOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(formOverflow).toBeLessThanOrEqual(0);
  await shoot(page, '17-formulario-movil');
  await axe(page, 'formulario en móvil');

  // Quitar lo último hace desaparecer el apartado.
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goBack();
  await page.getByRole('button', { name: 'Quitar Croissants' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByRole('heading', { name: 'Disponibilidad' })).toHaveCount(0);
});

test('los datos y fotografías persisten al reiniciar', async ({ page }) => {
  await stopServer();
  await startServer();
  await page.goto('/todas');
  await expect(page.locator('.card__title')).toHaveCount(3);
  await page.getByRole('link', { name: 'Café Prueba Uno' }).click();
  await expect(page.locator('.gallery__item')).toHaveCount(2);
  const loaded = await page.locator('.gallery__item img').first().evaluate(async (img: HTMLImageElement) => {
    img.loading = 'eager';
    await img.decode();
    return img.naturalWidth;
  });
  expect(loaded).toBeGreaterThan(0);
  await expect(general(page)).toHaveText('8.5');
});

test('respaldos: crear, perder datos y recuperarlos', async ({ page }) => {
  await page.goto('/respaldos');
  await page.getByRole('button', { name: 'Crear respaldo' }).click();
  await expect(page.locator('.backup-item')).toHaveCount(1);
  await shoot(page, '10-respaldos');
  await axe(page, 'respaldos');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Descargar' }).click()]);
  const zip = path.join(tmp, 'descargado.zip');
  await download.saveAs(zip);
  expect(fs.statSync(zip).size).toBeGreaterThan(1000);

  // Se pierden todos los lugares.
  const places = (await (await page.request.get('/api/establishments')).json()) as { id: number }[];
  for (const place of places) await page.request.delete(`/api/establishments/${place.id}`);
  await page.goto('/todas');
  await expect(page.getByText('Esta mesa sigue libre')).toBeVisible();

  // Se recuperan desde el archivo descargado.
  await page.goto('/respaldos');
  await page.locator('input[type=file]').setInputFiles(zip);
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
  await expect(page).toHaveURL(`${BASE}/`, { timeout: 15_000 });
  await page.goto('/todas');
  await expect(page.locator('.card__title')).toHaveCount(3);
  await page.getByRole('link', { name: 'Café Prueba Uno' }).click();
  await expect(page.locator('#temporada .seasonal__item')).toHaveCount(2);
  const seasonalPhoto = page.locator('.seasonal__photo img');
  await seasonalPhoto.scrollIntoViewIfNeeded();
  await expect.poll(() => seasonalPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.goto('/todas');
  await page.getByRole('link', { name: 'Panadería Prueba' }).click();
  await expect(page.locator('.review')).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'Calificación de Ana Prueba: 10.0 de 10' })).toBeVisible();
  const reviewPhoto = page.locator('.review__photo img');
  await reviewPhoto.scrollIntoViewIfNeeded();
  await expect.poll(() => reviewPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // La copia de seguridad automática quedó en la lista.
  await page.goto('/respaldos');
  await expect(page.getByText(/antes-de-restaurar/)).toBeVisible();
});

test('inicio con datos y adaptación a móvil y tablet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden(); // Sin hamburguesa en escritorio.
  await expect(page.locator('.ledger__item').first()).toContainText('3');
  await expect(page.locator('.hero__image')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mejor calificadas' })).toBeVisible();
  await shoot(page, '11-inicio');
  await axe(page, 'inicio con datos');

  const routes = ['/', '/todas', '/top', '/pasaporte', '/mapa', '/agregar', '/amigos', '/respaldos'];
  for (const [label, width, height] of [['movil', 375, 780], ['tablet', 800, 1100]] as const) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `Desborde horizontal en ${route} a ${width}px`).toBeLessThanOrEqual(0);
    }
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await shoot(page, `12-inicio-${label}`);
    await page.goto('/todas');
    await page.waitForLoadState('networkidle');
    await shoot(page, `13-todas-${label}`);
    await axe(page, `todas en ${label}`);
  }

  // Menú móvil.
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Mapa cafetero' })).toBeHidden();
  const addIcon = await page.locator('.site-header__add svg').boundingBox();
  expect(addIcon?.width).toBeGreaterThan(10); // El ícono de agregar se ve en móvil.
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await shoot(page, '14-menu-movil');
  await axe(page, 'menú móvil');
  await page.getByRole('link', { name: 'Mapa cafetero' }).click();
  await expect(page).toHaveURL(/mapa/);
  await expect(page.getByRole('link', { name: 'Solo cafeterías' })).toBeHidden();
});

test('acceso privado: con contraseña pide iniciar sesión, y sin ella no abre a la red', async ({ page, browser }) => {
  const privatePort = '5052';
  const privateData = path.join(tmp, 'data-privada');
  const entry = path.join(here, '..', 'server', 'dist', 'index.js');
  const env = { ...process.env, PORT: privatePort, DATA_DIR: privateData, HOST: '0.0.0.0', GOOGLE_MAPS_API_KEY: '' };

  // Abierto a la red sin contraseña, el servidor se niega a iniciar.
  const refused = spawn(process.execPath, [entry], { env: { ...env, APP_PASSWORD: '' }, stdio: 'ignore' });
  const code = await new Promise((resolve) => refused.once('exit', resolve));
  expect(code).toBe(1);

  const guarded = spawn(process.execPath, [entry], { env: { ...env, APP_PASSWORD: 'clave de prueba' }, stdio: 'ignore' });
  try {
    const url = `http://127.0.0.1:${privatePort}`;
    await expect.poll(() => fetch(`${url}/api/auth/status`).then((res) => res.status, () => 0), { timeout: 15_000 }).toBe(200);
    expect((await fetch(`${url}/api/establishments`)).status).toBe(401);

    const context = await browser.newContext({ viewport: { width: 375, height: 780 } });
    const phone = await context.newPage();
    await phone.goto(url);
    await expect(phone.getByRole('heading', { name: 'Los Amigos del Kaffe' })).toBeVisible();
    await expect(phone.getByText('Esta guía es privada.')).toBeVisible();
    await phone.getByLabel('Contraseña').fill('incorrecta');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await expect(phone.getByText('La contraseña no es correcta.')).toBeVisible();
    await shoot(phone, '18-acceso');
    await phone.getByLabel('Contraseña').fill('clave de prueba');
    await phone.getByRole('button', { name: 'Entrar' }).click();
    await expect(phone.getByText('La primera taza está por servirse')).toBeVisible();
    await phone.reload();
    await expect(phone.getByText('La primera taza está por servirse')).toBeVisible();
    await context.close();
  } finally {
    const exited = new Promise((resolve) => guarded.once('exit', resolve));
    guarded.kill();
    await exited;
  }
  void page;
});

test('jerarquía visual: título principal > apartado > subtítulo > texto', async ({ page }) => {
  const size = (selector: string) =>
    page.locator(selector).first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const check = async () => {
    const [main, section, subtitle, text, figure, label] = await Promise.all([
      size('.sheet-hero__title'),
      size('.sheet__title'),
      size('.answer-summary__title'),
      size('.answer-summary__row dd'),
      size('.score-board__value'),
      size('.answer-summary__row dt'),
    ]);
    expect(main).toBeGreaterThan(section);
    expect(section).toBeGreaterThan(subtitle);
    expect(subtitle).toBeGreaterThan(text);
    expect(section).toBeGreaterThan(figure);
    expect(label).toBe(text);
  };
  await page.goto('/todas');
  await page.locator('.card__link, .row__title a').filter({ hasText: 'Café Prueba Uno' }).first().click();
  await expect(page.locator('.answer-summary')).toBeVisible();
  await check();
  await page.setViewportSize({ width: 390, height: 844 });
  await check();
  await page.setViewportSize({ width: 1280, height: 800 });
});

test('sin errores en la consola del navegador', () => {
  expect(seen).toEqual([]);
});
