import argon2 from 'argon2';
import type { Request, RequestHandler } from 'express';
import {
  AccountExportSchema,
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  EventSchema,
} from '@mruos/shared';
import { EventModel } from '../models/event.js';
import { SemesterModel } from '../models/semester.js';
import { UserModel } from '../models/user.js';
import { clearLoginFailures } from './loginThrottle.js';
import { semesterFromRecord } from './semesterData.js';
import { clearSessionCookie, endSession } from './sessionHelpers.js';

// Every handler runs behind requireAuth, so the session belongs to a user.
function sessionUserId(request: Request): string {
  return request.session.userId ?? '';
}

/** Ends every other session; this one adopts the new version. */
async function bumpSessionVersion(request: Request): Promise<void> {
  const user = await UserModel.findByIdAndUpdate(
    sessionUserId(request),
    { $inc: { sessionVersion: 1 } },
    { returnDocument: 'after' },
  )
    .select('sessionVersion')
    .lean();
  request.session.sessionVersion = user?.sessionVersion;
}

export const getAccount: RequestHandler = async (request, response, next) => {
  try {
    const user = await UserModel.findById(sessionUserId(request))
      .select('email createdAt')
      .lean();
    response.json({
      email: user?.email,
      createdAt: user?.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword: RequestHandler = async (
  request,
  response,
  next,
) => {
  const input = ChangePasswordInputSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ error: 'invalid-input' });
    return;
  }

  try {
    const user = await UserModel.findById(sessionUserId(request));
    if (
      !user ||
      !(await argon2.verify(user.passwordHash, input.data.currentPassword))
    ) {
      response.status(403).json({ error: 'invalid-password' });
      return;
    }

    user.passwordHash = await argon2.hash(input.data.newPassword);
    await user.save();
    await bumpSessionVersion(request);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const logoutOtherSessions: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    await bumpSessionVersion(request);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const exportAccount: RequestHandler = async (
  request,
  response,
  next,
) => {
  const userId = sessionUserId(request);
  try {
    const [user, records, semesterRecord] = await Promise.all([
      UserModel.findById(userId).select('email createdAt').lean(),
      EventModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      SemesterModel.findOne({ userId }).lean(),
    ]);
    const exported = AccountExportSchema.parse({
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {
        email: user?.email,
        createdAt: user?.createdAt.toISOString(),
      },
      events: records.map((record) => ({
        id: record.clientId,
        event: EventSchema.parse(record.event),
      })),
      semester: semesterFromRecord(semesterRecord),
    });

    response.setHeader(
      'Content-Disposition',
      'attachment; filename="mruos-moje-dane.json"',
    );
    response.json(exported);
  } catch (error) {
    next(error);
  }
};

export const deleteAccount: RequestHandler = async (
  request,
  response,
  next,
) => {
  const input = DeleteAccountInputSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ error: 'invalid-input' });
    return;
  }

  const userId = sessionUserId(request);
  try {
    const user = await UserModel.findById(userId);
    if (
      !user ||
      !(await argon2.verify(user.passwordHash, input.data.password))
    ) {
      response.status(403).json({ error: 'invalid-password' });
      return;
    }

    await Promise.all([
      EventModel.deleteMany({ userId }),
      SemesterModel.deleteMany({ userId }),
      clearLoginFailures(user.email),
    ]);
    // With the user gone, requireAuth rejects every remaining session.
    await UserModel.deleteOne({ _id: userId });
    await endSession(request);
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};
