import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { CalendarSnapshotSchema, EventSchema } from '@mruos/shared';
import { EventModel } from '../models/event.js';
import { SemesterModel } from '../models/semester.js';
import { semesterFromRecord, semesterUpdate } from './semesterData.js';

export const getCalendar: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const [records, semesterRecord] = await Promise.all([
      EventModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      SemesterModel.findOne({ userId }).lean(),
    ]);
    const events = records.map((record) => ({
      id: record.clientId,
      event: EventSchema.parse(record.event),
    }));
    const semester = semesterFromRecord(semesterRecord);

    response.json(CalendarSnapshotSchema.parse({ events, semester }));
  } catch (error) {
    next(error);
  }
};

export const replaceCalendar: RequestHandler = async (
  request,
  response,
  next,
) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const input = CalendarSnapshotSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ error: 'invalid-calendar' });
    return;
  }

  try {
    const ownerId = new mongoose.Types.ObjectId(userId);
    const operations = input.data.events.map(({ id, event }) => ({
      updateOne: {
        filter: { userId: ownerId, clientId: id },
        update: {
          $set: { event },
          $setOnInsert: { userId: ownerId, clientId: id },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await EventModel.bulkWrite(operations, { ordered: true });
    }

    await SemesterModel.findOneAndUpdate(
      { userId },
      semesterUpdate(input.data.semester, userId),
      { upsert: true, runValidators: true },
    );

    const clientIds = input.data.events.map((series) => series.id);
    await EventModel.deleteMany(
      clientIds.length > 0
        ? { userId, clientId: { $nin: clientIds } }
        : { userId },
    );

    response.json(input.data);
  } catch (error) {
    next(error);
  }
};

export const clearCalendar: RequestHandler = async (
  request,
  response,
  next,
) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    await Promise.all([
      EventModel.deleteMany({ userId }),
      SemesterModel.deleteOne({ userId }),
    ]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};
