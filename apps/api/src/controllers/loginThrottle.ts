import { createHash } from 'node:crypto';
import { LoginThrottleModel } from '../models/loginThrottle.js';

export type LockoutPolicy = {
  /** Failed logins within `windowMs` that lock the e-mail. */
  maxFailures: number;
  windowMs: number;
  lockMs: number;
};

export const defaultLockoutPolicy: LockoutPolicy = {
  maxFailures: 10,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

// Tracked per e-mail whether or not an account exists, so a lock does not
// reveal which addresses are registered.
export function emailHash(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

export async function isLoginLocked(email: string, now = new Date()) {
  const record = await LoginThrottleModel.findOne({
    emailHash: emailHash(email),
  }).lean();

  return Boolean(record?.lockedUntil && record.lockedUntil > now);
}

/** Counts a failed login; returns true when the e-mail is now locked. */
export async function recordLoginFailure(
  email: string,
  policy: LockoutPolicy,
  now = new Date(),
): Promise<boolean> {
  const key = emailHash(email);
  const record = await LoginThrottleModel.findOne({ emailHash: key }).lean();
  const windowOpen =
    record !== null &&
    now.getTime() - record.windowStartedAt.getTime() < policy.windowMs;
  const failures = windowOpen ? record.failures + 1 : 1;
  const windowStartedAt = windowOpen ? record.windowStartedAt : now;
  const lockedUntil =
    failures >= policy.maxFailures
      ? new Date(now.getTime() + policy.lockMs)
      : null;
  const expiresAt = new Date(
    Math.max(
      windowStartedAt.getTime() + policy.windowMs,
      lockedUntil?.getTime() ?? 0,
    ),
  );

  await LoginThrottleModel.updateOne(
    { emailHash: key },
    { $set: { failures, windowStartedAt, lockedUntil, expiresAt } },
    { upsert: true },
  );

  return lockedUntil !== null;
}

export async function clearLoginFailures(email: string): Promise<void> {
  await LoginThrottleModel.deleteOne({ emailHash: emailHash(email) });
}
