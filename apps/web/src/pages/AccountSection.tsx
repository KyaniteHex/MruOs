import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AccountInfo } from '@mruos/shared';
import { accountErrorMessages } from '../accountApi';
import type { AccountApiError } from '../accountApi';
import { useAuth } from '../authContext';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';
import { minimumPasswordLength } from '../passwordStrength';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

function formatDate(isoDateTime: string): string {
  return isoDateTime.slice(0, 10).split('-').reverse().join('.');
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) {
    return null;
  }

  return feedback.kind === 'error' ? (
    <p className="form-errors" role="alert">
      {feedback.text}
    </p>
  ) : (
    <p className="auth-notice" role="status">
      {feedback.text}
    </p>
  );
}

/** "Konto" in the settings of a guest. */
export function GuestAccount() {
  return (
    <div className="settings-block">
      <p>
        Używasz MruOS bez konta: plan jest zapisany tylko w tej przeglądarce.
      </p>
      <p className="field-hint">
        Po założeniu konta plan z tej przeglądarki przeniesie się na nie przy
        pierwszym logowaniu i będzie dostępny na każdym urządzeniu.
      </p>
      <div className="settings-actions">
        <Link className="primary-button" to="/rejestracja">
          Załóż konto
        </Link>
        <Link className="secondary-button" to="/">
          Zaloguj się
        </Link>
      </div>
    </div>
  );
}

/** "Konto" in the settings of a signed-in student. */
export function AccountSection() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [sessionFeedback, setSessionFeedback] = useState<Feedback>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const { api, refresh } = auth;

  useEffect(() => {
    void api.account().then((result) => {
      if (result.success) {
        setAccount(result.value);
      } else if (result.error === 'unauthorized') {
        void refresh();
      }
    });
  }, [api, refresh]);

  // An ended session sends the student back to the login page.
  function failure(
    error: AccountApiError,
    messages: Partial<Record<AccountApiError, string>> = {},
  ): Feedback {
    if (error === 'unauthorized') {
      void refresh();
    }
    return {
      kind: 'error',
      text: messages[error] ?? accountErrorMessages[error],
    };
  }

  async function logout() {
    setBusy(true);
    await api.logout();
    auth.signOut();
    navigate('/', { replace: true });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ([...newPassword].length < minimumPasswordLength) {
      setPasswordFeedback({
        kind: 'error',
        text: `Nowe hasło musi mieć co najmniej ${minimumPasswordLength} znaków.`,
      });
      return;
    }
    if (newPassword !== repeated) {
      setPasswordFeedback({
        kind: 'error',
        text: 'Nowe hasła nie są takie same.',
      });
      return;
    }

    setBusy(true);
    const result = await api.changePassword(currentPassword, newPassword);
    setBusy(false);
    if (!result.success) {
      setPasswordFeedback(
        failure(result.error, {
          'invalid-password': 'Obecne hasło jest nieprawidłowe.',
        }),
      );
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setRepeated('');
    setPasswordFeedback({
      kind: 'success',
      text: 'Hasło zostało zmienione. Pozostałe urządzenia zostały wylogowane.',
    });
  }

  async function logoutOthers() {
    setBusy(true);
    const result = await api.logoutOthers();
    setBusy(false);
    setSessionFeedback(
      result.success
        ? { kind: 'success', text: 'Pozostałe urządzenia zostały wylogowane.' }
        : failure(result.error),
    );
  }

  async function deleteAccount() {
    setBusy(true);
    const result = await api.deleteAccount(deletePassword);
    setBusy(false);
    if (!result.success) {
      setConfirmingDelete(false);
      setDeleteFeedback(
        failure(result.error, {
          'invalid-password': 'Hasło jest nieprawidłowe.',
        }),
      );
      return;
    }
    // The login page shows the notice; settings also work without an
    // account, so they would not send the student there on their own.
    auth.signOut('Konto i wszystkie jego dane zostały usunięte.');
    navigate('/', { replace: true });
  }

  return (
    <>
      <div className="settings-row">
        <p className="account-summary">
          <strong>{account?.email ?? auth.user?.email}</strong>
          {account && <> · konto od {formatDate(account.createdAt)}</>}
        </p>
        <button
          className="secondary-button"
          disabled={busy}
          type="button"
          onClick={() => void logout()}
        >
          Wyloguj
        </button>
      </div>

      <div className="settings-block">
        <h3>Zmiana hasła</h3>
        <form
          className="auth-form"
          noValidate
          onSubmit={(event) => void changePassword(event)}
        >
          <label className="form-field">
            <span>Obecne hasło</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="form-field">
            <span>Nowe hasło</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </label>
          <PasswordStrengthMeter password={newPassword} />
          <label className="form-field">
            <span>Powtórz nowe hasło</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setRepeated(event.target.value)}
              type="password"
              value={repeated}
            />
          </label>
          <FeedbackMessage feedback={passwordFeedback} />
          <button className="primary-button" disabled={busy} type="submit">
            Zmień hasło
          </button>
        </form>
      </div>

      <div className="settings-block">
        <h3>Urządzenia</h3>
        <p className="field-hint">
          Wylogowuje wszystkie inne przeglądarki i telefony. To urządzenie
          pozostaje zalogowane.
        </p>
        <FeedbackMessage feedback={sessionFeedback} />
        <button
          className="secondary-button"
          disabled={busy}
          type="button"
          onClick={() => void logoutOthers()}
        >
          Wyloguj z pozostałych urządzeń
        </button>
      </div>

      <div className="settings-block account-danger">
        <h3>Usuń konto</h3>
        <p className="field-hint">
          Usuwa konto, plan, harmonogram, link subskrypcji i wszystkie sesje.
          Tej operacji nie można cofnąć. Kopię planu pobierzesz wcześniej w
          sekcji Plan („Eksport” → „Format JSON”).
        </p>
        <label className="form-field">
          <span>Hasło do usunięcia konta</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setDeletePassword(event.target.value)}
            type="password"
            value={deletePassword}
          />
        </label>
        <FeedbackMessage feedback={deleteFeedback} />
        {confirmingDelete ? (
          <div
            className="delete-confirmation"
            role="alertdialog"
            aria-label="Potwierdzenie usunięcia konta"
          >
            <p>Na pewno usunąć konto i wszystkie dane?</p>
            <button type="button" onClick={() => setConfirmingDelete(false)}>
              Anuluj
            </button>
            <button
              className="danger-button"
              disabled={busy}
              type="button"
              onClick={() => void deleteAccount()}
            >
              Tak, usuń konto
            </button>
          </div>
        ) : (
          <button
            className="danger-button"
            disabled={!deletePassword || busy}
            type="button"
            onClick={() => {
              setDeleteFeedback(null);
              setConfirmingDelete(true);
            }}
          >
            Usuń konto na zawsze
          </button>
        )}
      </div>
    </>
  );
}
