import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, renderApp, signedOut, stubApi } from '../testApp';

const student = { user: { id: 'user-1', email: 'student@example.com' } };
const account = {
  email: 'student@example.com',
  createdAt: '2026-10-01T10:00:00.000Z',
};

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('login page', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('explains failed and locked logins', async () => {
    let attempts = 0;
    stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/login': () => {
        attempts += 1;
        return attempts === 1
          ? json({ error: 'invalid-credentials' }, 401)
          : json({ error: 'too-many-attempts' }, 429);
      },
    });
    renderApp('/');

    type('E-mail', 'student@example.com');
    type('Hasło', 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Nieprawidłowy adres e-mail lub hasło.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Zbyt wiele nieudanych prób',
      ),
    );
  });

  it('opens the calendar without an account and remembers that choice', async () => {
    stubApi({ 'GET /auth/me': signedOut });
    renderApp('/');

    fireEvent.click(
      screen.getByRole('button', { name: 'Wypróbuj bez konta →' }),
    );

    expect(await screen.findByText('Tryb bez konta')).toBeTruthy();
    expect(window.localStorage.getItem('mruos-guest-mode')).toBe('true');
  });

  it('sends a signed-in student straight to the calendar', async () => {
    stubApi({
      'GET /auth/me': () => json(student),
      'GET /calendar': () =>
        json({
          events: [],
          semester: { startDate: '2026-10-01', daysOff: [] },
        }),
    });
    renderApp('/');

    expect(await screen.findByText('student@example.com')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Konto' })).toBeTruthy();
  });
});

describe('registration page', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('checks the password before creating the account', async () => {
    const fetcher = stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/register': () => json(student, 201),
      'GET /calendar': () =>
        json({
          events: [],
          semester: { startDate: '2026-10-01', daysOff: [] },
        }),
    });
    renderApp('/rejestracja');

    type('E-mail', 'student@example.com');
    type('Hasło (co najmniej 12 znaków)', 'Ksiazka-Kwiat-Morze-7');
    expect(screen.getByText('Silne')).toBeTruthy();
    type('Powtórz hasło', 'Ksiazka-Kwiat-Morze-8');
    fireEvent.click(screen.getByRole('button', { name: 'Zarejestruj' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Hasła nie są takie same.',
    );
    expect(
      fetcher.mock.calls.some(([url]) => String(url).endsWith('/register')),
    ).toBe(false);

    type('Powtórz hasło', 'Ksiazka-Kwiat-Morze-7');
    fireEvent.click(screen.getByRole('button', { name: 'Zarejestruj' }));
    expect(await screen.findByText('student@example.com')).toBeTruthy();
  });
});

describe('account page', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('changes the password and reports a wrong current one', async () => {
    let calls = 0;
    stubApi({
      'GET /auth/me': () => json(student),
      'GET /account': () => json(account),
      'POST /account/password': () => {
        calls += 1;
        return calls === 1
          ? json({ error: 'invalid-password' }, 403)
          : new Response(null, { status: 204 });
      },
    });
    renderApp('/konto');

    expect(await screen.findByText(/konto od 01\.10\.2026/)).toBeTruthy();
    type('Obecne hasło', 'wrong-password');
    type('Nowe hasło', 'Ksiazka-Kwiat-Morze-7');
    type('Powtórz nowe hasło', 'Ksiazka-Kwiat-Morze-7');
    fireEvent.click(screen.getByRole('button', { name: 'Zmień hasło' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Obecne hasło jest nieprawidłowe.',
    );

    type('Obecne hasło', 'correct-horse-battery');
    type('Nowe hasło', 'Ksiazka-Kwiat-Morze-7');
    type('Powtórz nowe hasło', 'Ksiazka-Kwiat-Morze-7');
    fireEvent.click(screen.getByRole('button', { name: 'Zmień hasło' }));
    expect(
      await screen.findByText(
        'Hasło zostało zmienione. Pozostałe urządzenia zostały wylogowane.',
      ),
    ).toBeTruthy();
  });

  it('deletes the account after confirmation and returns to login', async () => {
    let deleted = false;
    stubApi({
      'GET /auth/me': () => (deleted ? signedOut(undefined) : json(student)),
      'GET /account': () => json(account),
      'DELETE /account': (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          password: 'correct-horse-battery',
        });
        deleted = true;
        return new Response(null, { status: 204 });
      },
    });
    renderApp('/konto');

    const deleteButton = await screen.findByRole('button', {
      name: 'Usuń konto na zawsze',
    });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    type('Hasło do usunięcia konta', 'correct-horse-battery');
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'Tak, usuń konto' }));

    expect(
      await screen.findByText('Konto i wszystkie jego dane zostały usunięte.'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeTruthy();
  });

  it('is only for signed-in students', async () => {
    stubApi({ 'GET /auth/me': signedOut });
    renderApp('/konto');

    expect(
      await screen.findByRole('heading', { name: 'Zaloguj się' }),
    ).toBeTruthy();
  });
});
