import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hostnameOf = (host: string) => host.replace(/:\d+$/, '').toLowerCase();

/**
 * Por omisión la aplicación solo escucha en esta computadora y no pide contraseña.
 * Eso obliga a impedir que una página web cualquiera abierta en el mismo navegador
 * llame a la API local: se rechaza un Host ajeno (DNS rebinding) y cualquier
 * escritura que venga de otro origen (CSRF).
 */
export function localRequestGuard(req: Request, res: Response, next: NextFunction): void {
  const host = req.headers.host ?? '';
  if (LOOPBACK_HOSTS.has(hostnameOf(config.host)) && !LOOPBACK_HOSTS.has(hostnameOf(host))) {
    res.status(403).json({ error: { message: 'Host no permitido.' } });
    return;
  }
  const origin = req.headers.origin;
  if (origin && !SAFE_METHODS.has(req.method)) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      /* Un Origin inválido se trata como ajeno. */
    }
    if (originHost !== host && !(config.trustedDevOrigins as readonly string[]).includes(originHost)) {
      res.status(403).json({ error: { message: 'Origen no permitido.' } });
      return;
    }
  }
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // Los mosaicos de OpenStreetMap exigen recibir un Referer: no usar "no-referrer".
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
