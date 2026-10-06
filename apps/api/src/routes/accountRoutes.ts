import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  changePassword,
  deleteAccount,
  exportAccount,
  getAccount,
  logoutOtherSessions,
} from '../controllers/accountController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAccountRoutes(authLimiter: RequestHandler) {
  const accountRoutes = Router();

  accountRoutes.use(requireAuth);
  accountRoutes.get('/', getAccount);
  accountRoutes.get('/export', exportAccount);
  // Both check the password, so they share the login rate limit.
  accountRoutes.post('/password', authLimiter, changePassword);
  accountRoutes.post('/logout-others', logoutOtherSessions);
  accountRoutes.delete('/', authLimiter, deleteAccount);

  return accountRoutes;
}
