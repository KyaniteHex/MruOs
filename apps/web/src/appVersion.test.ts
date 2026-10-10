import { describe, expect, it } from 'vitest';
import { appVersion, versionLabel } from './appVersion';

describe('versionLabel', () => {
  it('names the commit and the build time in Warsaw', () => {
    expect(
      versionLabel({
        commit: 'd5b820c',
        changed: false,
        builtAt: '2026-10-10T18:25:00.000Z',
      }),
    ).toBe('d5b820c z 10.10.2026, 20:25');
    expect(
      versionLabel({
        commit: 'd5b820c',
        changed: true,
        builtAt: '2026-10-10T18:25:00.000Z',
      }),
    ).toBe('d5b820c + lokalne zmiany z 10.10.2026, 20:25');
  });

  it('gets the version of this build from the bundler', () => {
    expect(appVersion.commit).toMatch(/^[0-9a-f]{7,}$/);
  });
});
