import { execFileSync } from 'node:child_process';

/**
 * The commit the API runs, e.g. "d5b820c": Render names it, locally git
 * does. Shown by GET /health so it is clear what is deployed where.
 */
export function apiVersion(env: NodeJS.ProcessEnv = process.env): string {
  const commit = env.RENDER_GIT_COMMIT;
  if (commit) {
    return commit.slice(0, 7);
  }
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'nieznana';
  }
}
