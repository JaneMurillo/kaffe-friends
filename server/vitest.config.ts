import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Cada archivo de pruebas usa su propia carpeta de datos temporal.
    pool: 'forks',
    testTimeout: 30_000,
  },
});
