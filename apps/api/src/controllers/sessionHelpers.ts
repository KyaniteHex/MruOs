import type { Request, Response } from 'express';

/** Session length with "Nie wylogowuj mnie"; it renews on activity. */
export const rememberedSessionMs = 30 * 24 * 60 * 60 * 1000;

function regenerateSession(request: Request): Promise<void> {
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

export async function startSession(
  request: Request,
  user: { id: string; sessionVersion: number },
  remember: boolean,
): Promise<void> {
  // A fresh session id on every login prevents session fixation.
  await regenerateSession(request);
  request.session.userId = user.id;
  request.session.sessionVersion = user.sessionVersion;
  // Without "remember me" the cookie ends with the browser session.
  request.session.cookie.maxAge = remember ? rememberedSessionMs : undefined;
}

export function endSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie('mruos.sid', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
