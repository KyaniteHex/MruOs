import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  createLoginHandler,
  getCurrentUser,
  logoutUser,
  registerUser,
} from '../controllers/authController.js';
import type { LockoutPolicy } from '../controllers/loginThrottle.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAuthRoutes(
  authLimiter: RequestHandler,
  lockout: LockoutPolicy,
) {
  const authRoutes = Router();

  authRoutes.post('/register', authLimiter, registerUser);
  authRoutes.post('/login', authLimiter, createLoginHandler(lockout));
  authRoutes.post('/logout', requireAuth, logoutUser);
  authRoutes.get('/me', requireAuth, getCurrentUser);

  return authRoutes;
}
