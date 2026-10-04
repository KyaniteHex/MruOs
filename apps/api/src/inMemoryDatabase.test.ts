import { access, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startInMemoryDatabase } from './inMemoryDatabase.js';

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

describe('startInMemoryDatabase', () => {
  const killed = join(tmpdir(), 'mruos-db-test-killed');
  const stopped = join(tmpdir(), 'mruos-db-test-stopped');
  const abandoned = join(tmpdir(), 'mruos-db-test-abandoned');
  const starting = join(tmpdir(), 'mruos-db-test-starting');

  afterEach(async () => {
    await Promise.all(
      [killed, stopped, abandoned, starting].map((path) =>
        rm(path, { recursive: true, force: true }),
      ),
    );
  });

  it('removes its data on stop and directories left by killed processes', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    // A PID above the Linux maximum never belongs to a running process.
    await mkdir(killed, { recursive: true });
    await writeFile(join(killed, 'mongod.lock'), '4194305\n');
    await mkdir(stopped, { recursive: true });
    await writeFile(join(stopped, 'mongod.lock'), '');
    await mkdir(abandoned, { recursive: true });
    await utimes(abandoned, hourAgo, hourAgo);
    await mkdir(starting, { recursive: true });

    const database = await startInMemoryDatabase();

    expect(database.uri).toMatch(/^mongodb:\/\//);
    expect(await exists(killed)).toBe(false);
    expect(await exists(stopped)).toBe(false);
    expect(await exists(abandoned)).toBe(false);
    expect(await exists(starting)).toBe(true);

    expect(await exists(database.dbPath)).toBe(true);
    await database.stop();
    expect(await exists(database.dbPath)).toBe(false);
  }, 60_000);
});
