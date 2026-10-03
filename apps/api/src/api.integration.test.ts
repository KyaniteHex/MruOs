import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { EventModel } from './models/event.js';
import { SemesterModel } from './models/semester.js';
import { UserModel } from './models/user.js';

let mongoServer: MongoMemoryServer | undefined;
let app: Express;

const event = {
  kind: 'class',
  subject: 'Matematyka',
  classType: 'wyklad',
  color: '#25745b',
  building: 'Wydział Matematyki',
  room: '204',
  startTime: '08:00',
  endTime: '10:00',
  timezone: 'Europe/Warsaw',
  recurrence: {
    freq: 'WEEKLY',
    interval: 1,
    byDay: ['MO'],
    startDate: '2026-10-05',
    endDate: '2026-11-02',
  },
  exceptions: [],
};

async function registerAgent(
  email: string,
  password = 'correct-horse-battery',
) {
  const agent = request.agent(app);
  const response = await agent.post('/auth/register').send({ email, password });

  expect(response.status).toBe(201);
  return { agent, response };
}

describe('API integration and user isolation', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Promise.all([
      UserModel.init(),
      EventModel.init(),
      SemesterModel.init(),
    ]);
    app = createApp({
      sessionSecret: 'integration-test-secret-value-is-long-enough',
      secureCookies: false,
    });
  }, 60000);

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      EventModel.deleteMany({}),
      SemesterModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop({ doCleanup: true, force: true });
  }, 30000);

  it('hashes passwords and uses a protected session cookie', async () => {
    const { agent, response } = await registerAgent(' Student@example.com ');
    const savedUser = await UserModel.findOne({ email: 'student@example.com' });

    expect(response.body.user).toEqual({
      id: savedUser?.id,
      email: 'student@example.com',
    });
    expect(savedUser?.passwordHash).not.toBe('correct-horse-battery');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');

    const currentUser = await agent.get('/auth/me');
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user.email).toBe('student@example.com');

    expect((await agent.post('/auth/logout')).status).toBe(204);
    expect((await agent.get('/events')).status).toBe(401);
  });

  it('prevents one account from reading or mutating another account data', async () => {
    const { agent: userA } = await registerAgent('a@example.com');
    const { agent: userB } = await registerAgent('b@example.com');
    const created = await userA.post('/events').send({ id: 'series-a', event });

    expect(created.status).toBe(201);
    expect((await userA.get('/events')).body).toHaveLength(1);
    expect((await userB.get('/events')).body).toEqual([]);

    expect(
      (
        await userB
          .put('/events/series-a')
          .send({ event: { ...event, room: '999' } })
      ).status,
    ).toBe(404);
    expect((await userB.delete('/events/series-a')).status).toBe(404);
    expect((await userA.get('/events')).body[0].event.room).toBe('204');

    expect(
      (
        await userA
          .put('/semester')
          .send({ startDate: '2026-09-28', daysOff: ['2026-11-11'] })
      ).status,
    ).toBe(200);
    expect((await userB.get('/semester')).body).toEqual({
      startDate: '2026-09-28',
      daysOff: [],
    });
    expect((await userA.get('/calendar')).body.events).toHaveLength(1);
  });

  it('rate limits repeated login attempts', async () => {
    const limitedApp = createApp({
      sessionSecret: 'integration-test-secret-value-is-long-enough',
      authAttemptLimit: 2,
    });
    const attempt = () =>
      request(limitedApp)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });

  it('rejects invalid credentials and malformed event payloads', async () => {
    const { agent } = await registerAgent('student@example.com');
    const invalidLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'student@example.com', password: 'wrong-password' });
    const invalidEvent = await agent
      .post('/events')
      .send({ id: 'series-bad', event: { ...event, userId: 'a' } });

    expect(invalidLogin.status).toBe(401);
    expect(invalidEvent.status).toBe(400);
  });
});
