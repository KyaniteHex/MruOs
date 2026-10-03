import { Router } from 'express';
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from '../controllers/eventController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const eventRoutes = Router();

eventRoutes.use(requireAuth);
eventRoutes.get('/', listEvents);
eventRoutes.post('/', createEvent);
eventRoutes.put('/:id', updateEvent);
eventRoutes.delete('/:id', deleteEvent);
