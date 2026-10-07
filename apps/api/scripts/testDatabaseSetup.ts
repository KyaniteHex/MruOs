import { MongoBinary } from 'mongodb-memory-server';

// Integration test files start their databases in parallel. Without a cached
// binary, as on a fresh CI runner, they would all download it at once and
// trip over its lock file, so it is fetched once before they start.
export async function setup(): Promise<void> {
  await MongoBinary.getPath();
}
