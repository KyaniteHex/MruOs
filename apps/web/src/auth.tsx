import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthenticatedUser } from '@mruos/shared';
import { createAccountApi } from './accountApi';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';

const guestModeKey = 'mruos-guest-mode';

function readGuestMode(): boolean {
  try {
    return window.localStorage.getItem(guestModeKey) === 'true';
  } catch {
    return false;
  }
}

function writeGuestMode(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(guestModeKey, 'true');
    } else {
      window.localStorage.removeItem(guestModeKey);
    }
  } catch {
    // Without storage the choice simply lasts until the page is reloaded.
  }
}

export function AuthProvider({
  apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api',
  children,
}: {
  apiBaseUrl?: string;
  children: ReactNode;
}) {
  const api = useMemo(() => createAccountApi(apiBaseUrl), [apiBaseUrl]);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [guestMode, setGuestModeState] = useState(readGuestMode);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped on every sign-in or sign-out, so a slow answer to the initial
  // session check cannot undo a login made while it was pending.
  const changes = useRef(0);

  const refresh = useCallback(async () => {
    const result = await api.me();
    changes.current += 1;
    setUser(result.success ? result.value : null);
    setStatus(result.success ? 'signed-in' : 'signed-out');
    if (!result.success) {
      setNotice('Sesja wygasła. Zaloguj się ponownie.');
    }
    return result.success;
  }, [api]);
  const setGuestMode = useCallback((enabled: boolean) => {
    writeGuestMode(enabled);
    setGuestModeState(enabled);
  }, []);
  const signIn = useCallback((nextUser: AuthenticatedUser) => {
    changes.current += 1;
    setUser(nextUser);
    setStatus('signed-in');
    setNotice(null);
  }, []);
  const signOut = useCallback((nextNotice?: string) => {
    changes.current += 1;
    setUser(null);
    setStatus('signed-out');
    setNotice(nextNotice ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    const startedAt = changes.current;
    void api.me().then((result) => {
      if (active && changes.current === startedAt) {
        setUser(result.success ? result.value : null);
        setStatus(result.success ? 'signed-in' : 'signed-out');
      }
    });

    return () => {
      active = false;
    };
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      api,
      apiBaseUrl,
      guestMode,
      setGuestMode,
      signIn,
      signOut,
      notice,
      refresh,
    }),
    [
      notice,
      status,
      user,
      api,
      apiBaseUrl,
      guestMode,
      setGuestMode,
      signIn,
      signOut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
