import { Router } from 'express';
import {
  clearCalendar,
  getCalendar,
  replaceCalendar,
} from '../controllers/calendarController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const calendarRoutes = Router();

calendarRoutes.use(requireAuth);
calendarRoutes.get('/', getCalendar);
calendarRoutes.put('/', replaceCalendar);
calendarRoutes.delete('/', clearCalendar);
