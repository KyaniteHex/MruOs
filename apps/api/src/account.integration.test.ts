import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AccountExportSchema } from '@mruos/shared';
import { createApp } from './app.js';
import { startInMemoryDatabase } from './inMemoryDatabase.js';
import type { InMemoryDatabase } from './inMemoryDatabase.js';
import { EventModel } from './models/event.js';
import { LoginThrottleModel } from './models/loginThrottle.js';
import { SemesterModel } from './models/semester.js';
import { UserModel } from './models/user.js';

let database: InMemoryDatabase | undefined;
let app: Express;
const password = 'correct-horse-battery';
const event = {
  kind: 'class',
  subject: 'Biofarmacja',
  classType: 'wyklad',
  color: '#25745b',
  building: 'Patomorfologia',
  room: 'A019',
  startTime: '08:00',
  endTime: '09:30',
  timezone: 'Europe/Warsaw',
  recurrence: {
    freq: 'WEEKLY',
    interval: 1,
    byDay: ['WE'],
    startDate: '2026-10-07',
    endDate: '2026-12-09',
  },
  exceptions: [],
};

async function register(email: string, remember = false) {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/register')
    .send({ email, password, remember });
  expect(response.status).toBe(201);
  return { agent, response };
}

async function login(email: string, secret = password) {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/login')
    .send({ email, password: secret });
  return { agent, response };
}

describe('account settings', () => {
  beforeAll(async () => {
    database = await startInMemoryDatabase();
    await mongoose.connect(database.uri);
    await Promise.all([
      UserModel.init(),
      EventModel.init(),
      SemesterModel.init(),
      LoginThrottleModel.init(),
    ]);
    app = createApp({
      sessionSecret: 'account-test-secret-value-is-long-enough',
      authAttemptLimit: 1000,
      loginLockout: { maxFailures: 3 },
    });
  }, 60000);

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      EventModel.deleteMany({}),
      SemesterModel.deleteMany({}),
      LoginThrottleModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await database?.stop();
  }, 30000);

  it('keeps remembered sessions for 30 days and others for the browser session', async () => {
    const remembered = (await register('remember@example.com', true)).response;
    const browserOnly = (await register('browser@example.com')).response;

    const expires = /Expires=([^;]+)/.exec(
      remembered.headers['set-cookie']?.[0] ?? '',
    )?.[1];
    const days = (Date.parse(expires ?? '') - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(browserOnly.headers['set-cookie']?.[0]).not.toContain('Expires');
  });

  it('logs other devices out when the password changes', async () => {
    const { agent: laptop } = await register('student@example.com');
    const { agent: phone } = await login('student@example.com');

    expect(
      (
        await laptop.post('/account/password').send({
          currentPassword: 'wrong-password',
          newPassword: 'n' + password,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await laptop
          .post('/account/password')
          .send({ currentPassword: password, newPassword: 'new-' + password })
      ).status,
    ).toBe(204);

    expect((await laptop.get('/auth/me')).status).toBe(200);
    expect((await phone.get('/auth/me')).status).toBe(401);
    expect((await login('student@example.com')).response.status).toBe(401);
    expect(
      (await login('student@example.com', 'new-' + password)).response.status,
    ).toBe(200);
  });

  it('logs out the other devices only', async () => {
    const { agent: laptop } = await register('student@example.com');
    const { agent: phone } = await login('student@example.com');

    expect((await laptop.post('/account/logout-others')).status).toBe(204);
    expect((await laptop.get('/calendar')).status).toBe(200);
    expect((await phone.get('/calendar')).status).toBe(401);
  });

  it('exports the account data as an importable backup', async () => {
    const { agent } = await register('student@example.com');
    await agent.post('/events').send({ id: 'series-1', event });

    const account = await agent.get('/account');
    const exported = await agent.get('/account/export');

    expect(account.body.email).toBe('student@example.com');
    expect(exported.headers['content-disposition']).toContain('attachment');
    const data = AccountExportSchema.parse(exported.body);
    expect(data.account).toEqual(account.body);
    expect(data.events).toEqual([{ id: 'series-1', event }]);
  });

  it('deletes the account with all its data and sessions', async () => {
    const { agent: laptop, response } = await register('student@example.com');
    const { agent: phone } = await login('student@example.com');
    const userId: string = response.body.user.id;
    await laptop.post('/events').send({ id: 'series-1', event });
    await laptop
      .put('/semester')
      .send({ startDate: '2026-10-01', daysOff: [] });

    expect(
      (await laptop.delete('/account').send({ password: 'wrong-password' }))
        .status,
    ).toBe(403);
    expect((await laptop.delete('/account').send({ password })).status).toBe(
      204,
    );

    expect(await UserModel.countDocuments({ _id: userId })).toBe(0);
    expect(await EventModel.countDocuments({ userId })).toBe(0);
    expect(await SemesterModel.countDocuments({ userId })).toBe(0);
    expect((await laptop.get('/auth/me')).status).toBe(401);
    expect((await phone.get('/calendar')).status).toBe(401);
    expect((await login('student@example.com')).response.status).toBe(401);
  });

  it('locks an e-mail after repeated failures without revealing accounts', async () => {
    await register('student@example.com');
    const attempts = async (email: string) => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        statuses.push((await login(email, 'wrong-password')).response.status);
      }
      // Even the right password is refused while the lock lasts.
      statuses.push((await login(email)).response.status);
      return statuses;
    };

    expect(await attempts('student@example.com')).toEqual([401, 401, 429, 429]);
    expect(await attempts('nobody@example.com')).toEqual([401, 401, 429, 429]);
    const stored = await LoginThrottleModel.find().lean();
    expect(JSON.stringify(stored)).not.toContain('student@example.com');
  });
});
