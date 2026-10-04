import type { RequestHandler } from 'express';
import { SemesterSchema } from '@mruos/shared';
import { SemesterModel } from '../models/semester.js';
import { semesterFromRecord, semesterUpdate } from './semesterData.js';

export const getSemester: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const semester = await SemesterModel.findOne({ userId }).lean();
    response.json(semesterFromRecord(semester));
  } catch (error) {
    next(error);
  }
};

export const updateSemester: RequestHandler = async (
  request,
  response,
  next,
) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const input = SemesterSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ error: 'invalid-semester' });
    return;
  }

  try {
    const semester = await SemesterModel.findOneAndUpdate(
      { userId },
      semesterUpdate(input.data, userId),
      { returnDocument: 'after', upsert: true, runValidators: true },
    ).lean();

    response.json(semesterFromRecord(semester));
  } catch (error) {
    next(error);
  }
};
