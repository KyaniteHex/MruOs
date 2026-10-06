import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** Must match the user's sessionVersion; bumping it ends other sessions. */
    sessionVersion?: number;
  }
}
