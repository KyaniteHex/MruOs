import { useEffect, useState } from 'react';

/** Free hosting puts the API to sleep; a cold start can take a minute. */
export const slowServerMessage = 'Budzenie serwera, to może potrwać do minuty…';

/** True once `busy` has lasted longer than `delayMs`. */
export function useSlowHint(busy: boolean, delayMs = 5000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [busy, delayMs]);

  return slow;
}
