import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

const COOKIE = 'kaffe_session';
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60 * 1000;

const sign = (value: string) => createHmac('sha256', 'los-amigos-del-kaffe:v1').update(value).digest();

/** Compara resúmenes de igual longitud para no revelar nada por el tiempo de respuesta. */
const sameText = (a: string, b: string) => timingSafeEqual(sign(a), sign(b));

const sessionToken = () => sign(config.accessPassword).toString('hex');

function isAuthenticated(req: Request): boolean {
  if (!config.accessPassword) return true;
  const cookies = req.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
  const value = cookies.find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value !== undefined && sameText(value, sessionToken());
}

const failures = new Map<string, { count: number; until: number }>();

export const authController = {
  status(req: Request, res: Response) {
    res.json({ required: config.accessPassword !== '', authenticated: isAuthenticated(req) });
  },

  login(req: Request, res: Response) {
    const key = req.socket.remoteAddress ?? '';
    const record = failures.get(key);
    if (record && record.count >= MAX_FAILURES && record.until > Date.now()) {
      throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!config.accessPassword || !sameText(password, config.accessPassword)) {
      const count = record && record.until > Date.now() ? record.count + 1 : 1;
      failures.set(key, { count, until: Date.now() + LOCK_MS });
      throw new HttpError(401, 'La contraseña no es correcta.');
    }
    failures.delete(key);
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`,
    );
    res.status(204).end();
  },

  logout(_req: Request, res: Response) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.status(204).end();
  },
};

/** Protege los datos y las fotografías. La interfaz compilada no contiene datos personales. */
export function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const isPrivate = req.path.startsWith('/api/') || req.path.startsWith('/media/');
  const isAuthRoute = req.path.startsWith('/api/auth/');
  if (!isPrivate || isAuthRoute || isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({ error: { message: 'Inicia sesión para continuar.' } });
}
