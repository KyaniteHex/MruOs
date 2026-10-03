import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { Store } from 'express-session';
import { createAuthRoutes } from './routes/authRoutes.js';
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
  /**
   * Required header value on every request except /health. When set, the API
   * sits behind the Vercel proxy, so forwarded headers are trusted too.
   */
  originSecret?: string;
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
    response.json({ status: 'ok' });
  });
  if (options.originSecret) {
    app.use(requireOriginSecret(options.originSecret));
  }
  app.use(express.json({ limit: '1mb' }));

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

  app.use(
    session({
      name: 'mruos.sid',
      secret: options.sessionSecret,
      store: options.sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.secureCookies ?? false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  );

  app.use(
    '/auth',
    createAuthRoutes(
      options.authAttemptLimit ?? 10,
      Boolean(options.originSecret),
    ),
  );
  app.use('/events', eventRoutes);
  app.use('/semester', semesterRoutes);
  app.use('/calendar', calendarRoutes);
  app.use(errorHandler);

  return app;
}
