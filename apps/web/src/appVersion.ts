export type AppVersion = {
  /** The short commit, e.g. "d5b820c". */
  commit: string;
  /** Built from code with uncommitted changes, e.g. by `pnpm dev`. */
  changed: boolean;
  builtAt: string;
};

declare const __MRUOS_VERSION__: AppVersion;

/** This build of the app; vite.config.ts fills it in. */
export const appVersion: AppVersion = __MRUOS_VERSION__;

const builtAtFormat = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** "d5b820c z 10.10.2026, 20:25", with "+ lokalne zmiany" when changed. */
export function versionLabel({ commit, changed, builtAt }: AppVersion): string {
  const built = builtAtFormat.format(new Date(builtAt));

  return `${commit}${changed ? ' + lokalne zmiany' : ''} z ${built}`;
}
