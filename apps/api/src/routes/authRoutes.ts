import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, registerUser);
authRoutes.post('/login', authLimiter, loginUser);
authRoutes.post('/logout', requireAuth, logoutUser);
authRoutes.get('/me', requireAuth, getCurrentUser);
