import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from './database.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;

if (!mongoUri) {
  throw new Error('MONGODB_URI must be configured before starting the API');
}

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters');
}

const isProduction = process.env.NODE_ENV === 'production';
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

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void disconnectFromDatabase();
    });
  });
}
