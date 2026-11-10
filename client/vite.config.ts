import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo, la API y las fotografías las sirve Express.
    proxy: {
      '/api': 'http://127.0.0.1:5050',
      '/media': 'http://127.0.0.1:5050',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Leaflet solo se descarga en las vistas que muestran un mapa.
        manualChunks: { leaflet: ['leaflet', 'react-leaflet'] },
      },
    },
  },
});
