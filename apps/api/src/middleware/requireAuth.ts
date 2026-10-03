import type { RequestHandler } from 'express';

export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.session.userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
};
