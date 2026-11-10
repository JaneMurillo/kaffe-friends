import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaffe-auth-'));
process.env.DATA_DIR = dataDir;
process.env.APP_PASSWORD = 'contraseña de prueba';
process.env.GOOGLE_MAPS_API_KEY = '';

let app: Express;
let closeDatabase: () => void;

beforeAll(async () => {
  app = (await import('../src/app.js')).createApp();
  const connection = await import('../src/db/connection.js');
  closeDatabase = connection.closeDatabase;
  connection.openDatabase();
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('acceso privado con contraseña', () => {
  it('sin sesión no entrega datos, fotografías ni respaldos', async () => {
    for (const url of ['/api/stats', '/api/establishments', '/api/backups', '/media/establishments/x.webp']) {
      expect((await request(app).get(url)).status, url).toBe(401);
    }
    expect((await request(app).post('/api/establishments').send({ name: 'x' })).status).toBe(401);
    expect((await request(app).get('/api/auth/status')).body).toEqual({ required: true, authenticated: false });
  });

  it('rechaza una contraseña incorrecta y no crea sesión', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'otra' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('una cookie inventada no da acceso', async () => {
    const res = await request(app).get('/api/stats').set('Cookie', 'kaffe_session=inventada');
    expect(res.status).toBe(401);
  });

  it('con la contraseña correcta da acceso con una cookie HttpOnly, y cerrar sesión lo quita', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ password: 'contraseña de prueba' });
    expect(login.status).toBe(204);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain('contraseña');

    expect((await agent.get('/api/stats')).status).toBe(200);
    expect((await agent.get('/api/auth/status')).body.authenticated).toBe(true);

    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/stats')).status).toBe(401);
  });

  it('bloquea después de demasiados intentos fallidos', async () => {
    let last = 0;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      last = (await request(app).post('/api/auth/login').send({ password: 'mala' })).status;
    }
    expect(last).toBe(429);
  });
});
