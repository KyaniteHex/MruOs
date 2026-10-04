import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

export type InMemoryDatabase = {
  uri: string;
  dbPath: string;
  stop: () => Promise<void>;
};

const directoryPrefix = 'mruos-db-';
// How long a directory without an owner file may wait for its owner.
const startupGraceMs = 60_000;
const ownerFile = 'owner.pid';

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// Each database takes ~200 MB in the temp directory. Remove those whose
// owning process is gone, e.g. force-killed before it could clean up. The
// owner writes its PID right after creating the directory; a directory
// without that file is given time in case its owner is still starting.
async function removeStaleDirectories(): Promise<void> {
  const entries = await readdir(tmpdir()).catch(() => []);

  for (const entry of entries.filter((name) =>
    name.startsWith(directoryPrefix),
  )) {
    const path = join(tmpdir(), entry);
    const owner = Number.parseInt(
      (await readFile(join(path, ownerFile), 'utf8').catch(() => '')) || '',
      10,
    );
    const info = await stat(path).catch(() => null);
    const stale = Number.isInteger(owner)
      ? !isRunning(owner)
      : info !== null && Date.now() - info.mtimeMs > startupGraceMs;

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
  await writeFile(join(dbPath, ownerFile), String(process.pid));
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
