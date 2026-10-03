import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAuthRoutes(
  authAttemptLimit: number,
  behindOriginProxy: boolean,
) {
  // A fresh limiter per app keeps counters isolated between app instances.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authAttemptLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // 'trust proxy' is true only behind the Vercel proxy: direct requests are
    // rejected by requireOriginSecret and Vercel overwrites X-Forwarded-For,
    // so the forwarded client IP cannot be forged.
    validate: { trustProxy: !behindOriginProxy },
  });
  const authRoutes = Router();

  authRoutes.post('/register', authLimiter, registerUser);
  authRoutes.post('/login', authLimiter, loginUser);
  authRoutes.post('/logout', requireAuth, logoutUser);
  authRoutes.get('/me', requireAuth, getCurrentUser);

  return authRoutes;
}
