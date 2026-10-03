import { Router } from 'express';
import {
  getSemester,
  updateSemester,
} from '../controllers/semesterController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const semesterRoutes = Router();

semesterRoutes.use(requireAuth);
semesterRoutes.get('/', getSemester);
semesterRoutes.put('/', updateSemester);
