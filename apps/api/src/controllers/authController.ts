import argon2 from 'argon2';
import type { RequestHandler } from 'express';
import { LoginInputSchema, RegistrationInputSchema } from '@mruos/shared';
import { UserModel } from '../models/user.js';
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
} from './loginThrottle.js';
import type { LockoutPolicy } from './loginThrottle.js';
import {
  clearSessionCookie,
  endSession,
  startSession,
} from './sessionHelpers.js';

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

// Verifying against a throwaway hash when the e-mail is unknown keeps the
// response time the same, so it does not reveal whether an account exists.
let unknownUserHash: Promise<string> | undefined;
function hashForUnknownUser(): Promise<string> {
  unknownUserHash ??= argon2.hash('no-such-account-placeholder');
  return unknownUserHash;
}

export const registerUser: RequestHandler = async (request, response, next) => {
  const input = RegistrationInputSchema.safeParse(request.body);

  if (!input.success) {
    response.status(400).json({ error: 'invalid-input' });
    return;
  }

  try {
    const passwordHash = await argon2.hash(input.data.password);
    const user = await UserModel.create({
      email: input.data.email,
      passwordHash,
    });

    await startSession(request, user, input.data.remember);
    response.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      response.status(409).json({ error: 'email-already-registered' });
      return;
    }

    next(error);
  }
};

export function createLoginHandler(policy: LockoutPolicy): RequestHandler {
  return async (request, response, next) => {
    const input = LoginInputSchema.safeParse(request.body);

    if (!input.success) {
      response.status(400).json({ error: 'invalid-input' });
      return;
    }

    const { email, password, remember } = input.data;
    try {
      if (await isLoginLocked(email)) {
        response.status(429).json({ error: 'too-many-attempts' });
        return;
      }

      const user = await UserModel.findOne({ email });
      const passwordMatches = await argon2.verify(
        user?.passwordHash ?? (await hashForUnknownUser()),
        password,
      );

      if (!user || !passwordMatches) {
        const locked = await recordLoginFailure(email, policy);
        response.status(locked ? 429 : 401).json({
          error: locked ? 'too-many-attempts' : 'invalid-credentials',
        });
        return;
      }

      await clearLoginFailures(email);
      await startSession(request, user, remember);
      response.json({ user: { id: user.id, email: user.email } });
    } catch (error) {
      next(error);
    }
  };
}

export const logoutUser: RequestHandler = async (request, response, next) => {
  try {
    await endSession(request);
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const user = await UserModel.findById(request.session.userId).select(
      'email',
    );

    if (!user) {
      response.status(401).json({ error: 'unauthorized' });
      return;
    }

    response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
};
