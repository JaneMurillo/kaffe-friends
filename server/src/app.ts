import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import { config } from './config.js';
import { requireAccess } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { localRequestGuard, securityHeaders } from './middleware/security.js';
import { apiRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(localRequestGuard);
  app.use(securityHeaders);
  app.use(requireAccess);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  // Los nombres son UUID nuevos en cada subida: se pueden guardar en caché para siempre.
  app.use('/media', express.static(config.paths.uploads, { immutable: true, maxAge: '1y', index: false }));

  const { clientDist } = config.paths;
  const indexHtml = path.join(clientDist, 'index.html');
  app.use(express.static(clientDist, { index: false }));
  app.get('/{*path}', (_req, res) => {
    if (fs.existsSync(indexHtml)) {
      res.sendFile('index.html', { root: clientDist });
    } else {
      res.status(503).type('text').send('La interfaz no está compilada. Ejecuta "npm run build" y vuelve a iniciar.');
    }
  });

  app.use(errorHandler);
  return app;
}
