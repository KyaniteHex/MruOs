import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAuthRoutes(authAttemptLimit: number) {
  // A fresh limiter per app keeps counters isolated between app instances.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authAttemptLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const authRoutes = Router();

  authRoutes.post('/register', authLimiter, registerUser);
  authRoutes.post('/login', authLimiter, loginUser);
  authRoutes.post('/logout', requireAuth, logoutUser);
  authRoutes.get('/me', requireAuth, getCurrentUser);

  return authRoutes;
}
