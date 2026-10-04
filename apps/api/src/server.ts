import { randomBytes } from 'node:crypto';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from './database.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === 'production';
let mongoUri = process.env.MONGODB_URI;
let sessionSecret = process.env.SESSION_SECRET;
let stopDatabase: (() => Promise<void>) | undefined;

// `pnpm dev` works without any setup: a temporary database and secret are
// used locally when none are configured. Production must configure both.
if (!mongoUri && !isProduction) {
  const { startInMemoryDatabase } = await import('./inMemoryDatabase.js');
  const database = await startInMemoryDatabase();
  mongoUri = database.uri;
  stopDatabase = database.stop;
  console.warn(
    'MONGODB_URI is not set: using a temporary in-memory database. Its data is lost when the API restarts.',
  );
}

if (!sessionSecret && !isProduction) {
  sessionSecret = randomBytes(32).toString('hex');
  console.warn(
    'SESSION_SECRET is not set: using a random secret. Sessions end when the API restarts.',
  );
}

if (!mongoUri) {
  throw new Error('MONGODB_URI must be configured before starting the API');
}

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters');
}

const originSecret = process.env.ORIGIN_SECRET;

// Production traffic must arrive through the Vercel proxy; see requireOriginSecret.
if (isProduction && (!originSecret || originSecret.length < 32)) {
  throw new Error('ORIGIN_SECRET must contain at least 32 characters');
}

await connectToDatabase(mongoUri);

const sessionStore = MongoStore.create({
  client: mongoose.connection.getClient(),
  collectionName: 'sessions',
  ttl: 7 * 24 * 60 * 60,
});
const app = createApp({
  sessionSecret,
  sessionStore,
  secureCookies: isProduction,
  webOrigin: process.env.WEB_ORIGIN,
  originSecret,
});
const server = app.listen(port, () => {
  console.log(`MruOS API listening on port ${port}`);
});

async function shutdown() {
  // Keep-alive connections, e.g. from the Vite proxy, would hold close().
  server.closeAllConnections();
  server.close();
  await disconnectFromDatabase().catch(() => undefined);
  await stopDatabase?.();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown());
}
