import type { RequestHandler } from 'express';
import { UserModel } from '../models/user.js';

// A session is valid only while its version matches the user's: changing the
// password or logging out other devices bumps the version, which ends every
// older session at once. Deleting the account ends them too.
export const requireAuth: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const user = await UserModel.findById(userId)
      .select('sessionVersion')
      .lean();
    if (!user || user.sessionVersion !== request.session.sessionVersion) {
      request.session.destroy(() => {
        response.status(401).json({ error: 'unauthorized' });
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
