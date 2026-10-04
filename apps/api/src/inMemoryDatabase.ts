import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

export type InMemoryDatabase = {
  uri: string;
  dbPath: string;
  stop: () => Promise<void>;
};

const directoryPrefix = 'mruos-db-';
// How long a directory without mongod.lock may wait for its database.
const startupGraceMs = 60_000;

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// Each database takes ~200 MB in the temp directory. Remove those left by
// processes that were killed before they could clean up. mongod creates
// mongod.lock on start, keeps its PID there while running and empties it on
// exit; a directory without the file may belong to a database still starting.
async function removeStaleDirectories(): Promise<void> {
  const entries = await readdir(tmpdir()).catch(() => []);

  for (const entry of entries.filter((name) =>
    name.startsWith(directoryPrefix),
  )) {
    const path = join(tmpdir(), entry);
    const lock = await readFile(join(path, 'mongod.lock'), 'utf8').catch(
      () => null,
    );
    const pid = Number.parseInt(lock ?? '', 10);
    const info = await stat(path).catch(() => null);
    const stale =
      lock === null
        ? info !== null && Date.now() - info.mtimeMs > startupGraceMs
        : !Number.isInteger(pid) || !isRunning(pid);

    if (stale) {
      await rm(path, { recursive: true, force: true });
    }
  }
}

// A throwaway MongoDB for local development and tests, so the API runs
// without a database service. Never loaded in production.
export async function startInMemoryDatabase(): Promise<InMemoryDatabase> {
  await removeStaleDirectories();
  const dbPath = await mkdtemp(join(tmpdir(), directoryPrefix));
  const server = await MongoMemoryServer.create({ instance: { dbPath } });

  return {
    uri: server.getUri(),
    dbPath,
    async stop() {
      // The data is discarded anyway, and a graceful mongod shutdown takes
      // longer than tsx watch waits before force-killing the API.
      server.instanceInfo?.instance.mongodProcess?.kill('SIGKILL');
      await server.stop({ force: true }).catch(() => undefined);
      await rm(dbPath, { recursive: true, force: true });
    },
  };
}
