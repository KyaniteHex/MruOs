// API for Playwright runs: an in-memory MongoDB, so E2E needs no database
// service locally or in CI. Never use it outside tests.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { EventModel } from '../src/models/event.js';
import { SemesterModel } from '../src/models/semester.js';
import { UserModel } from '../src/models/user.js';

const port = Number(process.env.PORT ?? 3101);
// An own dbPath is removed on shutdown even when mongod is already gone:
// Playwright signals the whole process group, mongod included.
const dbPath = await mkdtemp(join(tmpdir(), 'mruos-e2e-'));
const mongoServer = await MongoMemoryServer.create({ instance: { dbPath } });

await mongoose.connect(mongoServer.getUri());
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
  await mongoServer.stop({ force: true }).catch(() => undefined);
  await rm(dbPath, { recursive: true, force: true });
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown());
}
