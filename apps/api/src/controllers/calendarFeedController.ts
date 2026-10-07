import { createHash, randomBytes } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import {
  CalendarFeedOptionsSchema,
  CalendarFeedSchema,
  CreatedCalendarFeedSchema,
} from '@mruos/shared';
import type { CalendarFeed } from '@mruos/shared';
import { calendarIcs, defaultFeedOptions } from '@mruos/shared/ics';
import { CalendarFeedModel } from '../models/calendarFeed.js';
import type { CalendarFeedRecord } from '../models/calendarFeed.js';
import { loadCalendar } from './calendarData.js';

const feedFile = /^([\w-]{43})\.ics$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// The management handlers run behind requireAuth.
function sessionUserId(request: Request): string {
  return request.session.userId ?? '';
}

function feedView(feed: CalendarFeedRecord | null): CalendarFeed {
  return feed
    ? CalendarFeedSchema.parse({
        active: true,
        createdAt: feed.linkCreatedAt.toISOString(),
        options: CalendarFeedOptionsSchema.parse(feed.options),
      })
    : { active: false, options: defaultFeedOptions };
}

export const getCalendarFeed: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const feed = await CalendarFeedModel.findOne({
      userId: sessionUserId(request),
    }).lean();
    response.json(feedView(feed));
  } catch (error) {
    next(error);
  }
};

/** Creates the link, or replaces it so that the old one stops working. */
export const createCalendarFeed: RequestHandler = async (
  request,
  response,
  next,
) => {
  const userId = sessionUserId(request);
  // 256 random bits, 43 characters in the link.
  const token = randomBytes(32).toString('base64url');

  try {
    const feed = await CalendarFeedModel.findOneAndUpdate(
      { userId },
      {
        $set: { tokenHash: hashToken(token), linkCreatedAt: new Date() },
        $setOnInsert: { userId, options: defaultFeedOptions },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean();

    response
      .status(201)
      .json(CreatedCalendarFeedSchema.parse({ ...feedView(feed), token }));
  } catch (error) {
    next(error);
  }
};

export const updateCalendarFeedOptions: RequestHandler = async (
  request,
  response,
  next,
) => {
  const options = CalendarFeedOptionsSchema.safeParse(request.body);
  if (!options.success) {
    response.status(400).json({ error: 'invalid-input' });
    return;
  }

  try {
    const feed = await CalendarFeedModel.findOneAndUpdate(
      { userId: sessionUserId(request) },
      { $set: { options: options.data } },
      { returnDocument: 'after' },
    ).lean();
    if (!feed) {
      response.status(404).json({ error: 'not-found' });
      return;
    }

    response.json(feedView(feed));
  } catch (error) {
    next(error);
  }
};

export const deleteCalendarFeed: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await CalendarFeedModel.deleteOne({ userId: sessionUserId(request) });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};

/** The subscription itself: a calendar file behind a secret link. */
export const serveCalendarFeed: RequestHandler = async (
  request,
  response,
  next,
) => {
  const token = feedFile.exec(String(request.params.file))?.[1];

  try {
    const feed = token
      ? await CalendarFeedModel.findOne({ tokenHash: hashToken(token) }).lean()
      : null;
    // Unknown and revoked links look the same.
    if (!feed) {
      response.status(404).type('text/plain').send('Not found');
      return;
    }

    const calendar = await loadCalendar(String(feed.userId));
    response
      .type('text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', 'inline; filename="mruos.ics"')
      .send(
        calendarIcs(calendar, CalendarFeedOptionsSchema.parse(feed.options)),
      );
  } catch (error) {
    next(error);
  }
};
