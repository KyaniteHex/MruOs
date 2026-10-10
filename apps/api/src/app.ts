import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { Store } from 'express-session';
import type { Health } from '@mruos/shared';
import { defaultLockoutPolicy } from './controllers/loginThrottle.js';
import type { LockoutPolicy } from './controllers/loginThrottle.js';
import { createAuthLimiter } from './middleware/authLimiter.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { createAccountRoutes } from './routes/accountRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import {
  calendarFeedRoutes,
  createIcalRoutes,
} from './routes/calendarFeedRoutes.js';
import { calendarRoutes } from './routes/calendarRoutes.js';
import { eventRoutes } from './routes/eventRoutes.js';
import { semesterRoutes } from './routes/semesterRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireOriginSecret } from './middleware/requireOriginSecret.js';

export type AppOptions = {
  sessionSecret: string;
  sessionStore?: Store;
  secureCookies?: boolean;
  webOrigin?: string;
  /** Login and registration attempts per IP in a 15-minute window. */
  authAttemptLimit?: number;
  /** Failed logins per e-mail that lock it for a while. */
  loginLockout?: Partial<LockoutPolicy>;
  /** Subscription downloads per IP in a 15-minute window. */
  feedRequestLimit?: number;
  /**
   * Required header value on every request except /health. When set, the API
   * sits behind the Vercel proxy, so forwarded headers are trusted too.
   */
  originSecret?: string;
  /** The commit the API runs, reported by GET /health. */
  version?: string;
};

export function createApp(options: AppOptions) {
  const app = express();

  app.disable('x-powered-by');
  if (options.originSecret) {
    // Vercel overwrites X-Forwarded-For with the visitor IP and sets
    // X-Forwarded-Proto, so req.ip and secure cookies work behind it.
    app.set('trust proxy', true);
  }
  app.use(helmet());
  app.use((_request, response, next) => {
    // Calendars are private; a CDN in front of the API must never cache them.
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_request, response) => {
    const health: Health = options.version
      ? { status: 'ok', version: options.version }
      : { status: 'ok' };
    response.json(health);
  });
  if (options.originSecret) {
    app.use(requireOriginSecret(options.originSecret));
  }
  // Room for a full plan with up to 1000 kolokwia, exams and notes.
  app.use(express.json({ limit: '4mb' }));

  if (options.webOrigin) {
    app.use((request, response, next) => {
      const origin = request.get('origin');

      if (origin && origin === options.webOrigin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Credentials', 'true');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader(
          'Access-Control-Allow-Methods',
          'GET,POST,PUT,DELETE,OPTIONS',
        );
        response.vary('Origin');
      }

      if (request.method === 'OPTIONS') {
        response.status(origin === options.webOrigin ? 204 : 403).end();
        return;
      }

      next();
    });
  }

  // Subscribed calendars send no cookies, so these come before sessions.
  app.use(
    '/ical',
    createIcalRoutes(
      createRateLimiter(
        options.feedRequestLimit ?? 60,
        Boolean(options.originSecret),
      ),
    ),
  );

  app.use(
    session({
      name: 'mruos.sid',
      secret: options.sessionSecret,
      store: options.sessionStore,
      resave: false,
      saveUninitialized: false,
      // Remembered sessions get a fresh 30-day expiry on every request.
      rolling: true,
      // No maxAge here: the cookie lasts for the browser session unless the
      // login asks to be remembered (see startSession).
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.secureCookies ?? false,
        path: '/',
      },
    }),
  );

  const authLimiter = createAuthLimiter(
    options.authAttemptLimit ?? 10,
    Boolean(options.originSecret),
  );
  app.use(
    '/auth',
    createAuthRoutes(authLimiter, {
      ...defaultLockoutPolicy,
      ...options.loginLockout,
    }),
  );
  app.use('/account', createAccountRoutes(authLimiter));
  app.use('/events', eventRoutes);
  app.use('/semester', semesterRoutes);
  app.use('/calendar', calendarRoutes);
  app.use('/calendar-feed', calendarFeedRoutes);
  app.use(errorHandler);

  return app;
}
