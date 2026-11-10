import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '.tmp/results',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  expect: { timeout: 8_000 },
  use: {
    actionTimeout: 10_000,
    // Sin animaciones, la auditoría de contraste mide los colores finales.
    contextOptions: { reducedMotion: 'reduce' },
    baseURL: 'http://localhost:5051',
    locale: 'es-MX',
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
  },
});
