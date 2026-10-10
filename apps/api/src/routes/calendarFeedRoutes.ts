import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  createCalendarFeed,
  deleteCalendarFeed,
  getCalendarFeed,
  serveCalendarFeed,
  updateCalendarFeedOptions,
} from '../controllers/calendarFeedController.js';
import { requireAuth } from '../middleware/requireAuth.js';

/** Managing the account's subscription link. */
export const calendarFeedRoutes = Router();

calendarFeedRoutes.use(requireAuth);
calendarFeedRoutes.get('/', getCalendarFeed);
calendarFeedRoutes.post('/', createCalendarFeed);
calendarFeedRoutes.put('/options', updateCalendarFeedOptions);
calendarFeedRoutes.delete('/', deleteCalendarFeed);

/** Subscribed calendars fetch these without a session. */
export function createIcalRoutes(limiter: RequestHandler) {
  const icalRoutes = Router();

  icalRoutes.get('/:file', limiter, serveCalendarFeed);

  return icalRoutes;
}
