import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { CalendarBackupSchema, CalendarSnapshotSchema } from '@mruos/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, renderApp, signedOut, stubApi } from './testApp';

const emptyAccount = {
  events: [],
  semester: { startDate: '2026-09-28', daysOff: [] },
};
const student = { user: { id: 'user-1', email: 'student@example.com' } };

function addClass(subject: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Dodaj zajęcia' }));
  fireEvent.change(screen.getByLabelText('Przedmiot'), {
    target: { value: subject },
  });
  fireEvent.change(screen.getByLabelText('Budynek'), {
    target: { value: 'Wydział Testowy' },
  });
  fireEvent.change(screen.getByLabelText('Sala'), {
    target: { value: '101' },
  });
  const eventForm = document.querySelector('.event-form');
  if (!eventForm) {
    throw new Error('Event form was not rendered');
  }
  fireEvent.submit(eventForm);
}

function storedSubjects(): string[] {
  return CalendarBackupSchema.parse(
    JSON.parse(window.localStorage.getItem('mruos-calendar-v1') ?? 'null'),
  ).events.map((series) => series.event.subject);
}

describe('calendar', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('sends visitors without a session or guest choice to the login page', async () => {
    stubApi({ 'GET /auth/me': signedOut });

    renderApp('/kalendarz');

    expect(
      await screen.findByRole('heading', { name: 'Zaloguj się' }),
    ).toBeTruthy();
  });

  it('keeps a guest plan in the browser across visits', async () => {
    stubApi({ 'GET /auth/me': signedOut });
    window.localStorage.setItem('mruos-guest-mode', 'true');
    window.localStorage.setItem(
      'mruos-calendar-v1',
      JSON.stringify({
        version: 1,
        events: [],
        semester: { startDate: '2027-02-01', daysOff: [] },
      }),
    );

    const first = renderApp('/kalendarz');
    expect(screen.getByText('Tryb bez konta')).toBeTruthy();
    addClass('LocalStorage test');
    await waitFor(() =>
      expect(storedSubjects()).toContain('LocalStorage test'),
    );

    first.unmount();
    renderApp('/kalendarz');
    expect(screen.getByText('2027-02-01')).toBeTruthy();
  });

  it('moves the guest plan to an empty account at the first login', async () => {
    let migratedSubjects: string[] = [];
    let signedIn = false;
    const fetcher = stubApi({
      'GET /auth/me': () => (signedIn ? json(student) : signedOut(undefined)),
      'POST /auth/login': (init) => {
        signedIn = true;
        expect(JSON.parse(String(init?.body))).toMatchObject({
          remember: true,
        });
        return json(student);
      },
      'GET /calendar': () => json(emptyAccount),
      'PUT /calendar': (init) => {
        const snapshot = CalendarSnapshotSchema.parse(
          JSON.parse(String(init?.body)),
        );
        migratedSubjects = snapshot.events.map((s) => s.event.subject);
        return json(snapshot);
      },
    });
    window.localStorage.setItem('mruos-guest-mode', 'true');

    renderApp('/kalendarz');
    addClass('Migrated plan');
    await waitFor(() => expect(storedSubjects()).toContain('Migrated plan'));

    fireEvent.click(screen.getByRole('link', { name: 'Zaloguj się' }));
    fireEvent.change(await screen.findByLabelText('E-mail'), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Hasło'), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));

    await waitFor(() => expect(migratedSubjects).toContain('Migrated plan'));
    expect(await screen.findByText('student@example.com')).toBeTruthy();
    expect(window.localStorage.getItem('mruos-calendar-v1:migrated')).toBe(
      'true',
    );
    expect(fetcher).toHaveBeenCalled();
  });

  it('shows nothing to edit until the account plan has loaded', async () => {
    let sendPlan: (response: Response) => void = () => undefined;
    stubApi({
      'GET /auth/me': () => json(student),
      'GET /calendar': () =>
        new Promise<Response>((resolve) => {
          sendPlan = resolve;
        }),
    });

    renderApp('/kalendarz');

    expect(await screen.findByText('Wczytywanie planu…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wyloguj' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dodaj zajęcia' })).toBeNull();

    sendPlan(json(emptyAccount));

    expect(
      await screen.findByRole('button', { name: 'Dodaj zajęcia' }),
    ).toBeTruthy();
    expect(screen.getByText('2026-09-28')).toBeTruthy();
  });

  it('offers another try when the account plan cannot be loaded', async () => {
    let attempts = 0;
    stubApi({
      'GET /auth/me': () => json(student),
      'GET /calendar': () => {
        attempts += 1;
        return attempts === 1
          ? new Response(null, { status: 503 })
          : json(emptyAccount);
      },
    });

    renderApp('/kalendarz');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nie można połączyć się z API.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(
      await screen.findByRole('button', { name: 'Dodaj zajęcia' }),
    ).toBeTruthy();
  });

  it('returns to the login page when the session ends elsewhere', async () => {
    let signedIn = true;
    stubApi({
      'GET /auth/me': () => (signedIn ? json(student) : signedOut(undefined)),
      'GET /calendar': () => json(emptyAccount),
      'PUT /calendar': () => {
        signedIn = false;
        return signedOut(undefined);
      },
    });
    // Guest mode must not keep the account's plan on screen.
    window.localStorage.setItem('mruos-guest-mode', 'true');

    renderApp('/kalendarz');
    expect(await screen.findByText('student@example.com')).toBeTruthy();
    addClass('Lost change');

    expect(
      await screen.findByText('Sesja wygasła. Zaloguj się ponownie.'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeTruthy();
  });

  it('does not move the local plan again to an empty account', async () => {
    const fetcher = stubApi({
      'GET /auth/me': () =>
        json({ user: { id: 'user-2', email: 'other@example.com' } }),
      'GET /calendar': () => json(emptyAccount),
    });
    window.localStorage.setItem(
      'mruos-calendar-v1',
      JSON.stringify({ version: 1, ...emptyAccount }),
    );
    window.localStorage.setItem('mruos-calendar-v1:migrated', 'true');

    renderApp('/kalendarz');

    expect(await screen.findByText('other@example.com')).toBeTruthy();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(
      false,
    );
  });
});
