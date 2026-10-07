import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { startInMemoryDatabase } from './inMemoryDatabase.js';
import type { InMemoryDatabase } from './inMemoryDatabase.js';
import { CalendarFeedModel } from './models/calendarFeed.js';
import { EntryModel } from './models/entry.js';
import { EventModel } from './models/event.js';
import { LoginThrottleModel } from './models/loginThrottle.js';
import { SemesterModel } from './models/semester.js';
import { UserModel } from './models/user.js';

let database: InMemoryDatabase | undefined;
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

const kolokwium = {
  kind: 'test',
  subject: 'Matematyka',
  title: 'Kolokwium',
  reminders: ['P1D'],
  anchor: {
    type: 'class',
    classType: 'wyklad',
    date: '2026-10-12',
    startTime: '08:00',
  },
};
const note = {
  kind: 'note',
  subject: 'Matematyka',
  text: 'Przynieść kalkulator',
  anchor: { type: 'subject' },
};
const semester = { startDate: '2026-10-01', daysOff: [] };

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
    database = await startInMemoryDatabase();
    await mongoose.connect(database.uri);
    await Promise.all([
      UserModel.init(),
      EventModel.init(),
      EntryModel.init(),
      SemesterModel.init(),
      CalendarFeedModel.init(),
    ]);
    app = createApp({
      sessionSecret: 'integration-test-secret-value-is-long-enough',
      secureCookies: false,
      // Limits have their own tests with their own app.
      authAttemptLimit: 1000,
    });
  }, 60000);

  afterEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      EventModel.deleteMany({}),
      EntryModel.deleteMany({}),
      SemesterModel.deleteMany({}),
      CalendarFeedModel.deleteMany({}),
      LoginThrottleModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await database?.stop();
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

  it('stores kolokwia, exams and notes with each account’s plan', async () => {
    const { agent: userA } = await registerAgent('a@example.com');
    const { agent: userB } = await registerAgent('b@example.com');
    const entries = [
      { id: 'entry-1', entry: kolokwium },
      { id: 'entry-2', entry: note },
    ];

    const saved = await userA.put('/calendar').send({
      events: [{ id: 'series-a', event }],
      semester,
      entries,
    });
    // The same client ids in another account are separate entries.
    await userB.put('/calendar').send({
      events: [],
      semester,
      entries: [{ id: 'entry-1', entry: { ...note, text: 'Inna' } }],
    });

    expect(saved.status).toBe(200);
    expect((await userA.get('/calendar')).body.entries).toEqual(entries);
    expect((await userB.get('/calendar')).body.entries).toEqual([
      { id: 'entry-1', entry: { ...note, text: 'Inna' } },
    ]);
  });

  it('keeps entries when a page from before entries saves the plan', async () => {
    const { agent } = await registerAgent('a@example.com');
    const entries = [{ id: 'entry-1', entry: kolokwium }];
    await agent.put('/calendar').send({ events: [], semester, entries });

    const oldPage = await agent.put('/calendar').send({ events: [], semester });

    expect(oldPage.body.entries).toEqual(entries);
    expect((await agent.get('/calendar')).body.entries).toEqual(entries);

    await agent.put('/calendar').send({ events: [], semester, entries: [] });
    expect((await agent.get('/calendar')).body.entries).toEqual([]);
  });

  it('rejects entries that break the rules', async () => {
    const { agent } = await registerAgent('a@example.com');

    const response = await agent.put('/calendar').send({
      events: [],
      semester,
      entries: [
        {
          id: 'entry-1',
          entry: { ...kolokwium, anchor: { type: 'subject' } },
        },
      ],
    });

    expect(response.status).toBe(400);
    expect(await EntryModel.countDocuments()).toBe(0);
  });

  describe('calendar subscription', () => {
    const allOptions = {
      assessments: true,
      notes: true,
      daysOff: false,
      periods: false,
    };

    // Calendar files fold long lines; joining them back gives the text.
    async function fetchFeed(token: string) {
      const response = await request(app).get(`/ical/${token}.ics`);
      return { ...response, text: response.text.replace(/\r\n[ \t]/g, '') };
    }

    async function subscribe(agent: ReturnType<typeof request.agent>) {
      await agent.put('/calendar').send({
        events: [{ id: 'series-a', event }],
        semester,
        entries: [
          { id: 'entry-1', entry: kolokwium },
          { id: 'entry-2', entry: note },
        ],
      });
      const created = await agent.post('/calendar-feed');
      expect(created.status).toBe(201);
      return created.body as { token: string; active: boolean };
    }

    it('serves the plan behind a secret link with the chosen options', async () => {
      const { agent } = await registerAgent('a@example.com');
      expect((await agent.get('/calendar-feed')).body).toEqual({
        active: false,
        options: {
          assessments: true,
          notes: false,
          daysOff: false,
          periods: false,
        },
      });

      const { token, active } = await subscribe(agent);
      const feed = await fetchFeed(token);

      expect(active).toBe(true);
      expect(token).toMatch(/^[\w-]{43}$/);
      expect(feed.status).toBe(200);
      expect(feed.headers['content-type']).toContain('text/calendar');
      expect(feed.text).toContain('SUMMARY:⚑ Matematyka · Kolokwium');
      expect(feed.text).not.toContain('Przynieść kalkulator');

      await agent.put('/calendar-feed/options').send(allOptions);
      expect((await fetchFeed(token)).text).toContain(
        'Notatka do przedmiotu: Przynieść kalkulator',
      );
      // Only a hash of the token is stored.
      const stored = await CalendarFeedModel.findOne().lean();
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it('stops serving old links once replaced or turned off', async () => {
      const { agent } = await registerAgent('a@example.com');
      const { token: first } = await subscribe(agent);

      const second = (await agent.post('/calendar-feed')).body.token;

      expect((await request(app).get(`/ical/${first}.ics`)).status).toBe(404);
      expect((await request(app).get(`/ical/${second}.ics`)).status).toBe(200);
      expect((await agent.delete('/calendar-feed')).status).toBe(204);
      expect((await request(app).get(`/ical/${second}.ics`)).status).toBe(404);
      expect((await agent.get('/calendar-feed')).body.active).toBe(false);
    });

    it('keeps each account’s subscription to itself', async () => {
      const { agent: userA } = await registerAgent('a@example.com');
      const { agent: userB } = await registerAgent('b@example.com');
      await subscribe(userA);

      expect((await userB.get('/calendar-feed')).body.active).toBe(false);
      expect(
        (await userB.put('/calendar-feed/options').send(allOptions)).status,
      ).toBe(404);
      expect((await request(app).get('/calendar-feed')).status).toBe(401);
      for (const file of [
        'nope.ics',
        `${'a'.repeat(43)}.ics`,
        'a'.repeat(43),
      ]) {
        expect((await request(app).get(`/ical/${file}`)).status).toBe(404);
      }
      expect(
        (await userA.put('/calendar-feed/options').send({ notes: true }))
          .status,
      ).toBe(400);
    });

    it('limits how often a link can be fetched', async () => {
      const limitedApp = createApp({
        sessionSecret: 'integration-test-secret-value-is-long-enough',
        feedRequestLimit: 2,
      });
      const fetch = () =>
        request(limitedApp).get(`/ical/${'a'.repeat(43)}.ics`);

      expect((await fetch()).status).toBe(404);
      expect((await fetch()).status).toBe(404);
      expect((await fetch()).status).toBe(429);
    });
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

  describe('behind the Vercel proxy', () => {
    const originSecret = 'proxy-origin-secret-value-at-least-32-chars';
    const proxiedApp = () =>
      createApp({
        sessionSecret: 'integration-test-secret-value-is-long-enough',
        secureCookies: true,
        originSecret,
        authAttemptLimit: 2,
      });
    const login = (
      app: Express,
      visitorIp: string,
      secret: string | null = originSecret,
    ) => {
      const pending = request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', visitorIp)
        .set('X-Forwarded-Proto', 'https')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });

      return secret ? pending.set('X-Origin-Secret', secret) : pending;
    };

    it('rejects requests that bypass the proxy but keeps /health open', async () => {
      const app = proxiedApp();

      expect((await request(app).get('/health')).status).toBe(200);
      expect((await login(app, '203.0.113.1', null)).status).toBe(403);
      expect((await login(app, '203.0.113.1', 'wrong-secret')).status).toBe(
        403,
      );
      expect((await login(app, '203.0.113.1')).status).toBe(401);
    });

    it('issues secure cookies for proxied HTTPS requests', async () => {
      const response = await request(proxiedApp())
        .post('/auth/register')
        .set('X-Origin-Secret', originSecret)
        .set('X-Forwarded-Proto', 'https')
        .send({
          email: 'proxied@example.com',
          password: 'correct-horse-battery',
        });

      expect(response.status).toBe(201);
      expect(response.headers['set-cookie']?.[0]).toContain('Secure');
    });

    it('rate limits each visitor separately', async () => {
      const app = proxiedApp();

      expect((await login(app, '203.0.113.1')).status).toBe(401);
      expect((await login(app, '203.0.113.1')).status).toBe(401);
      expect((await login(app, '203.0.113.1')).status).toBe(429);
      expect((await login(app, '198.51.100.7')).status).toBe(401);
    });
  });

  it('stores the academic calendar with the semester', async () => {
    const { agent } = await registerAgent('calendar@example.com');
    const academicYear = {
      startYear: 2026,
      semesters: [
        {
          term: 'winter',
          startDate: '2026-10-01',
          endDate: '2027-02-21',
          periods: [
            {
              label: 'Zajęcia dydaktyczne',
              kind: 'teaching',
              startDate: '2026-10-02',
              endDate: '2026-12-20',
            },
          ],
        },
      ],
      daysOff: [
        { date: '2026-11-11', label: 'Narodowe Święto Niepodległości' },
      ],
    };
    const semester = {
      startDate: '2026-10-01',
      daysOff: ['2026-11-11'],
      academicYear,
    };

    expect(
      (await agent.put('/calendar').send({ events: [], semester })).status,
    ).toBe(200);
    expect((await agent.get('/calendar')).body.semester).toEqual(semester);
    expect((await agent.get('/semester')).body.academicYear).toEqual(
      academicYear,
    );

    const withoutCalendar = { startDate: '2026-10-01', daysOff: [] };
    expect((await agent.put('/semester').send(withoutCalendar)).body).toEqual(
      withoutCalendar,
    );
    expect(
      (
        await agent.put('/semester').send({
          ...semester,
          academicYear: { ...academicYear, startYear: 'x' },
        })
      ).status,
    ).toBe(400);
  });

  it('forbids caching of API responses', async () => {
    const { agent } = await registerAgent('cache@example.com');

    expect((await agent.get('/calendar')).headers['cache-control']).toBe(
      'no-store',
    );
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
