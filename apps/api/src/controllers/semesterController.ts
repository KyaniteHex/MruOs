import type { RequestHandler } from 'express';
import { SemesterSchema } from '@mruos/shared';
import { SemesterModel } from '../models/semester.js';

export const getSemester: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const semester = await SemesterModel.findOne({ userId }).lean();
    response.json(
      semester
        ? SemesterSchema.parse({
            startDate: semester.startDate,
            daysOff: semester.daysOff,
          })
        : { startDate: '2026-09-28', daysOff: [] },
    );
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
      { $set: input.data, $setOnInsert: { userId } },
      { returnDocument: 'after', upsert: true, runValidators: true },
    ).lean();

    response.json(
      SemesterSchema.parse({
        startDate: semester.startDate,
        daysOff: semester.daysOff,
      }),
    );
  } catch (error) {
    next(error);
  }
};
