import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { AccountInfo } from '@mruos/shared';
import { accountErrorMessages } from '../accountApi';
import type { AccountApiError } from '../accountApi';
import { useAuth } from '../authContext';
import { downloadFile } from '../fileDownload';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';
import { minimumPasswordLength } from '../passwordStrength';
import { AuthLayout } from './AuthLayout';

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

export function AccountPage() {
  const auth = useAuth();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [sessionFeedback, setSessionFeedback] = useState<Feedback>(null);
  const [exportFeedback, setExportFeedback] = useState<Feedback>(null);
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

  async function exportData() {
    setBusy(true);
    const result = await api.exportData();
    setBusy(false);
    if (!result.success) {
      setExportFeedback(failure(result.error));
      return;
    }
    downloadFile(
      `mruos-moje-dane-${result.value.exportedAt.slice(0, 10)}.json`,
      'application/json',
      JSON.stringify(result.value, null, 2),
    );
    setExportFeedback({
      kind: 'success',
      text: 'Plik z danymi został pobrany. Możesz go wczytać przez „Import JSON”.',
    });
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
    // The account route then sends the student to the login page.
    auth.signOut('Konto i wszystkie jego dane zostały usunięte.');
  }

  return (
    <AuthLayout title="Twoje konto" wide>
      <p className="account-summary">
        <strong>{account?.email ?? auth.user?.email}</strong>
        {account && <> · konto od {formatDate(account.createdAt)}</>}
      </p>
      <p>
        <Link to="/kalendarz">← Wróć do kalendarza</Link>
      </p>

      <section className="account-section" aria-labelledby="password-title">
        <h2 id="password-title">Zmiana hasła</h2>
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
      </section>

      <section className="account-section" aria-labelledby="sessions-title">
        <h2 id="sessions-title">Urządzenia</h2>
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
      </section>

      <section className="account-section" aria-labelledby="data-title">
        <h2 id="data-title">Twoje dane</h2>
        <p className="field-hint">
          Plik JSON z danymi konta, planem i harmonogramem.
        </p>
        <FeedbackMessage feedback={exportFeedback} />
        <button
          className="secondary-button"
          disabled={busy}
          type="button"
          onClick={() => void exportData()}
        >
          Pobierz moje dane
        </button>
      </section>

      <section
        className="account-section account-danger"
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">Usuń konto</h2>
        <p className="field-hint">
          Usuwa konto, plan, harmonogram i wszystkie sesje. Tej operacji nie
          można cofnąć.
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
      </section>
    </AuthLayout>
  );
}
