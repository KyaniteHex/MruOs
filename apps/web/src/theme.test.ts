import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readThemePreference, saveThemePreference } from './theme';

function systemDark(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('theme', () => {
  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it('follows the system until the student chooses', () => {
    systemDark(true);
    applyTheme();

    expect(readThemePreference()).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('remembers a chosen theme on this device', () => {
    systemDark(true);
    saveThemePreference('light');

    expect(readThemePreference()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    saveThemePreference('system');
    expect(window.localStorage.getItem('mruos-theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
