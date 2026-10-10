import type { RequestHandler } from 'express';
import { createRateLimiter } from './rateLimiter.js';

/** Per-IP limit for requests that check a password. */
export function createAuthLimiter(
  authAttemptLimit: number,
  behindOriginProxy: boolean,
): RequestHandler {
  return createRateLimiter(authAttemptLimit, behindOriginProxy);
}
