import { useCallback, useSyncExternalStore } from 'react';

/** Phones and tablets held upright; matches the stylesheet's breakpoint. */
export const narrowScreenQuery = '(max-width: 900px)';

/** Phones; matches the stylesheet's breakpoint. */
export const phoneScreenQuery = '(max-width: 600px)';

/** Whether the media query matches; false where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
  );
}
