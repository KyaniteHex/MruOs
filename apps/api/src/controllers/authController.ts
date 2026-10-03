import argon2 from 'argon2';
import type { RequestHandler } from 'express';
import { LoginInputSchema, RegistrationInputSchema } from '@mruos/shared';
import { UserModel } from '../models/user.js';

function regenerateSession(
  request: Parameters<RequestHandler>[0],
): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
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

    await regenerateSession(request);
    request.session.userId = user.id;
    response.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      response.status(409).json({ error: 'email-already-registered' });
      return;
    }

    next(error);
  }
};

export const loginUser: RequestHandler = async (request, response, next) => {
  const input = LoginInputSchema.safeParse(request.body);

  if (!input.success) {
    response.status(400).json({ error: 'invalid-input' });
    return;
  }

  try {
    const user = await UserModel.findOne({ email: input.data.email });
    const passwordMatches = user
      ? await argon2.verify(user.passwordHash, input.data.password)
      : false;

    if (!user || !passwordMatches) {
      response.status(401).json({ error: 'invalid-credentials' });
      return;
    }

    await regenerateSession(request);
    request.session.userId = user.id;
    response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
};

export const logoutUser: RequestHandler = (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie('mruos.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    response.status(204).end();
  });
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
