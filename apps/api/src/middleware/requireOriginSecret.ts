import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

export const originSecretHeader = 'x-origin-secret';

function digest(value: string): Buffer {
  // Equal-length digests let timingSafeEqual compare secrets of any length.
  return createHash('sha256').update(value).digest();
}

// In production the API is reachable only through the Vercel rewrite, which
// sets this header. Direct requests could otherwise forge X-Forwarded-For and
// slip past the per-IP login rate limit.
export function requireOriginSecret(secret: string): RequestHandler {
  const expected = digest(secret);

  return (request, response, next) => {
    const received = request.get(originSecretHeader);

    if (!received || !timingSafeEqual(digest(received), expected)) {
      response.status(403).json({ error: 'forbidden' });
      return;
    }

    next();
  };
}
