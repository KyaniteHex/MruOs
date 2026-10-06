import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { accountErrorMessages } from '../accountApi';
import { useAuth } from '../authContext';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';
import { minimumPasswordLength } from '../passwordStrength';
import { slowServerMessage, useSlowHint } from '../useSlowHint';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slow = useSlowHint(busy);

  if (auth.status === 'signed-in') {
    return <Navigate to="/kalendarz" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ([...password].length < minimumPasswordLength) {
      setError(`Hasło musi mieć co najmniej ${minimumPasswordLength} znaków.`);
      return;
    }
    if (password !== repeated) {
      setError('Hasła nie są takie same.');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await auth.api.register({ email, password, remember });
    setBusy(false);
    if (!result.success) {
      setError(accountErrorMessages[result.error]);
      return;
    }
    auth.signIn(result.value);
    navigate('/kalendarz', { replace: true });
  }

  return (
    <AuthLayout title="Załóż konto">
      <form
        className="auth-form"
        noValidate
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
          <span>Hasło (co najmniej {minimumPasswordLength} znaków)</span>
          <input
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <PasswordStrengthMeter password={password} />
        <label className="form-field">
          <span>Powtórz hasło</span>
          <input
            autoComplete="new-password"
            onChange={(event) => setRepeated(event.target.value)}
            required
            type="password"
            value={repeated}
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
        <p className="field-hint">
          Zakładając konto, akceptujesz{' '}
          <Link to="/prywatnosc">zasady prywatności</Link>.
        </p>
        {error && (
          <p className="form-errors" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Zakładanie konta…' : 'Zarejestruj'}
        </button>
        {slow && (
          <p className="field-hint" role="status">
            {slowServerMessage}
          </p>
        )}
      </form>
      <p className="auth-switch">
        Masz już konto? <Link to="/">Zaloguj się</Link>
      </p>
    </AuthLayout>
  );
}
