// API for Playwright runs on a throwaway in-memory MongoDB, so E2E needs no
// database service locally or in CI. Never use it outside tests.
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { startInMemoryDatabase } from '../src/inMemoryDatabase.js';
import { EventModel } from '../src/models/event.js';
import { SemesterModel } from '../src/models/semester.js';
import { UserModel } from '../src/models/user.js';

const port = Number(process.env.PORT ?? 3101);
const database = await startInMemoryDatabase();

await mongoose.connect(database.uri);
await Promise.all([UserModel.init(), EventModel.init(), SemesterModel.init()]);

const app = createApp({
  sessionSecret: 'e2e-only-session-secret-value-32-chars',
  // Every E2E test registers its own account from the same IP.
  authAttemptLimit: 10_000,
});
const server = app.listen(port, () => {
  console.log(`MruOS E2E API listening on port ${port}`);
});

async function shutdown() {
  server.closeAllConnections();
  server.close();
  await mongoose.disconnect().catch(() => undefined);
  await database.stop();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown());
}
