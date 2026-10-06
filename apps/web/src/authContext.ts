import { createContext, useContext } from 'react';
import type { AuthenticatedUser } from '@mruos/shared';
import type { AccountApi } from './accountApi';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  api: AccountApi;
  apiBaseUrl: string;
  /** The student chose "Wypróbuj bez konta": the plan lives in the browser. */
  guestMode: boolean;
  setGuestMode: (enabled: boolean) => void;
  signIn: (user: AuthenticatedUser) => void;
  /** Ends the session locally; the notice is shown on the login page. */
  signOut: (notice?: string) => void;
  /** E.g. "Konto zostało usunięte", shown once on the login page. */
  notice: string | null;
  /**
   * Checks the session again, e.g. after the API rejected it; resolves to
   * whether the student is still signed in.
   */
  refresh: () => Promise<boolean>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
