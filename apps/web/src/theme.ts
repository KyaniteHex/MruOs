// The colour theme: chosen per device and stored in this browser. index.html
// applies it before the first paint; this module changes and follows it.

export type ThemePreference = 'light' | 'dark' | 'system';

const storageKey = 'mruos-theme';
const darkQuery = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemIsDark(): boolean {
  return window.matchMedia?.(darkQuery).matches ?? false;
}

export function applyTheme(
  preference: ThemePreference = readThemePreference(),
) {
  const dark =
    preference === 'dark' || (preference === 'system' && systemIsDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, preference);
    }
  } catch {
    // The choice still applies until the page is reloaded.
  }
  applyTheme(preference);
}

/** Follows the system theme while the student has not chosen one. */
export function followSystemTheme(): () => void {
  const query = window.matchMedia?.(darkQuery);
  if (!query) {
    return () => undefined;
  }

  const update = () => applyTheme();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
