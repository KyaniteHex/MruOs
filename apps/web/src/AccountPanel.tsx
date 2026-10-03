import { useState } from 'react';
import type { FormEvent } from 'react';
import { AuthResponseSchema } from '@mruos/shared';
import type { AuthenticatedUser } from '@mruos/shared';

type AccountPanelProps = {
  user: AuthenticatedUser | null;
  apiBaseUrl: string;
  onAuthenticated: (user: AuthenticatedUser) => Promise<boolean>;
  onLogout: () => void;
};

type AuthMode = 'login' | 'register';

export function AccountPanel({
  user,
  apiBaseUrl,
  onAuthenticated,
  onLogout,
}: AccountPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(
          response.status === 409
            ? 'Konto z tym adresem już istnieje.'
            : response.status === 401
              ? 'Nieprawidłowy adres e-mail lub hasło.'
              : 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.',
        );
        return;
      }

      const authResponse = AuthResponseSchema.safeParse(await response.json());
      if (!authResponse.success) {
        setError('Serwer zwrócił nieprawidłowe dane konta.');
        return;
      }

      if (await onAuthenticated(authResponse.data.user)) {
        setOpen(false);
        setEmail('');
        setPassword('');
      } else {
        setError('Nie udało się wczytać kalendarza konta.');
      }
    } catch {
      setError('Nie można połączyć się z serwerem.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        setError('Nie udało się wylogować.');
        return;
      }

      onLogout();
    } catch {
      setError('Nie można połączyć się z serwerem.');
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="account-controls">
        <span className="account-email">{user.email}</span>
        <button
          className="secondary-button account-button"
          disabled={busy}
          type="button"
          onClick={() => void handleLogout()}
        >
          Wyloguj
        </button>
        {error && (
          <span className="account-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        className="secondary-button account-button"
        type="button"
        onClick={() => setOpen(true)}
      >
        Zaloguj
      </button>
      {open && (
        <div className="modal-backdrop">
          <section
            className="event-form-modal account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
          >
            <header className="form-header">
              <div>
                <p className="eyebrow">KONTO MRUOS</p>
                <h2 id="account-title">
                  {mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
                </h2>
              </div>
              <button
                className="icon-close"
                type="button"
                onClick={() => setOpen(false)}
              >
                Zamknij
              </button>
            </header>
            <form className="event-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>E-mail</span>
                <input
                  autoComplete="email"
                  onChange={(change) => setEmail(change.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="form-field account-password-field">
                <span>Hasło</span>
                <input
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  minLength={mode === 'register' ? 12 : 1}
                  onChange={(change) => setPassword(change.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              {error && (
                <p className="form-errors" role="alert">
                  {error}
                </p>
              )}
              <footer className="form-actions account-form-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError(null);
                  }}
                >
                  {mode === 'login' ? 'Utwórz konto' : 'Mam już konto'}
                </button>
                <span className="form-action-spacer" />
                <button
                  className="primary-button"
                  disabled={busy}
                  type="submit"
                >
                  {mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
