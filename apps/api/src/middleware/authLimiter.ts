import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

/** Per-IP limit for requests that check a password. */
export function createAuthLimiter(
  authAttemptLimit: number,
  behindOriginProxy: boolean,
): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authAttemptLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // 'trust proxy' is true only behind the Vercel proxy: direct requests are
    // rejected by requireOriginSecret and Vercel overwrites X-Forwarded-For,
    // so the forwarded client IP cannot be forged.
    validate: { trustProxy: !behindOriginProxy },
  });
}
