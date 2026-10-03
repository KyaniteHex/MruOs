import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import {
  EventCreateInputSchema,
  EventSchema,
  EventUpdateInputSchema,
} from '@mruos/shared';
import { EventModel } from '../models/event.js';

export const listEvents: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const records = await EventModel.find({ userId })
      .sort({ createdAt: 1 })
      .lean();
    const events = records.map((record) => ({
      id: record.clientId,
      event: EventSchema.parse(record.event),
    }));

    response.json(events);
  } catch (error) {
    next(error);
  }
};

export const createEvent: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const input = EventCreateInputSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ error: 'invalid-event' });
    return;
  }

  try {
    const clientId = input.data.id ?? randomUUID();
    await EventModel.create({
      userId,
      clientId,
      event: input.data.event,
    });

    response.status(201).json({ id: clientId, event: input.data.event });
  } catch (error) {
    next(error);
  }
};

export const updateEvent: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  const input = EventUpdateInputSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ error: 'invalid-event' });
    return;
  }

  try {
    const record = await EventModel.findOneAndUpdate(
      { userId, clientId: request.params.id },
      { $set: { event: input.data.event } },
      { returnDocument: 'after', runValidators: true },
    ).lean();

    if (!record) {
      response.status(404).json({ error: 'event-not-found' });
      return;
    }

    response.json({ id: record.clientId, event: input.data.event });
  } catch (error) {
    next(error);
  }
};

export const deleteEvent: RequestHandler = async (request, response, next) => {
  const userId = request.session.userId;
  if (!userId) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const result = await EventModel.deleteOne({
      userId,
      clientId: request.params.id,
    });

    if (result.deletedCount === 0) {
      response.status(404).json({ error: 'event-not-found' });
      return;
    }

    response.status(204).end();
  } catch (error) {
    next(error);
  }
};
