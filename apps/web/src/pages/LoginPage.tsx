import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { accountErrorMessages } from '../accountApi';
import { useAuth } from '../authContext';
import { slowServerMessage, useSlowHint } from '../useSlowHint';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const notice = auth.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slow = useSlowHint(busy);

  if (auth.status === 'signed-in') {
    return <Navigate to="/kalendarz" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await auth.api.login({ email, password, remember });
    setBusy(false);
    if (!result.success) {
      setError(accountErrorMessages[result.error]);
      return;
    }
    auth.signIn(result.value);
    navigate('/kalendarz', { replace: true });
  }

  function continueAsGuest() {
    auth.setGuestMode(true);
    navigate('/kalendarz');
  }

  return (
    <AuthLayout title="Zaloguj się">
      {notice && (
        <p className="auth-notice" role="status">
          {notice}
        </p>
      )}
      <form
        className="auth-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label className="form-field">
          <span>E-mail</span>
          <input
            autoComplete="email"
            autoFocus
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="form-field">
          <span>Hasło</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label className="interval-option">
          <input
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            type="checkbox"
          />
          <span>Nie wylogowuj mnie (30 dni)</span>
        </label>
        {error && (
          <p className="form-errors" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Logowanie…' : 'Zaloguj'}
        </button>
        {slow && (
          <p className="field-hint" role="status">
            {slowServerMessage}
          </p>
        )}
      </form>
      <p className="auth-switch">
        Nie masz konta? <Link to="/rejestracja">Załóż konto</Link>
      </p>
      <div className="auth-guest">
        <button className="text-button" type="button" onClick={continueAsGuest}>
          {auth.guestMode ? 'Wróć do planu bez konta' : 'Wypróbuj bez konta'} →
        </button>
        <p className="field-hint">
          Plan zostanie zapisany tylko w tej przeglądarce.
        </p>
      </div>
    </AuthLayout>
  );
}
