import { describe, expect, it } from 'vitest';
import { apiVersion } from './version.js';

describe('apiVersion', () => {
  it('shortens the commit Render deploys', () => {
    expect(
      apiVersion({
        RENDER_GIT_COMMIT: 'd5b820c0123456789abcdef0123456789abcdef0',
      }),
    ).toBe('d5b820c');
  });

  it('asks git locally', () => {
    expect(apiVersion({})).toMatch(/^[0-9a-f]{7,}$/);
  });
});
