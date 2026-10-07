import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { CalendarSnapshotSchema } from '@mruos/shared';
import { EntryModel } from '../models/entry.js';
import { EventModel } from '../models/event.js';
import { SemesterModel } from '../models/semester.js';
import { loadCalendar, loadEntries } from './calendarData.js';
import { semesterUpdate } from './semesterData.js';

export const getCalendar: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    response.json(await loadCalendar(userId));
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
  // A page loaded before entries existed sends none; its saves must not
  // remove the entries made elsewhere.
  const sentEntries =
    typeof request.body === 'object' &&
    request.body !== null &&
    'entries' in request.body;

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

    if (sentEntries) {
      const entryOperations = input.data.entries.map(({ id, entry }) => ({
        updateOne: {
          filter: { userId: ownerId, clientId: id },
          update: {
            $set: { entry },
            $setOnInsert: { userId: ownerId, clientId: id },
          },
          upsert: true,
        },
      }));
      if (entryOperations.length > 0) {
        await EntryModel.bulkWrite(entryOperations, { ordered: true });
      }

      const entryIds = input.data.entries.map((record) => record.id);
      await EntryModel.deleteMany(
        entryIds.length > 0
          ? { userId, clientId: { $nin: entryIds } }
          : { userId },
      );
    }

    response.json({
      ...input.data,
      entries: sentEntries ? input.data.entries : await loadEntries(userId),
    });
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
      EntryModel.deleteMany({ userId }),
      SemesterModel.deleteOne({ userId }),
    ]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};
