import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { CalendarBackupSchema, CalendarSnapshotSchema } from '@mruos/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows the MruOS schedule heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Plan zajęć' })).toBeTruthy();
  });

  it('persists a new series and loads it again after remounting', async () => {
    window.localStorage.setItem(
      'mruos-calendar-v1',
      JSON.stringify({
        version: 1,
        events: [],
        semester: { startDate: '2027-02-01', daysOff: [] },
      }),
    );
    const firstRender = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj zajęcia' }));
    fireEvent.change(screen.getByLabelText('Przedmiot'), {
      target: { value: 'LocalStorage test' },
    });
    fireEvent.change(screen.getByLabelText('Budynek'), {
      target: { value: 'Wydział Testowy' },
    });
    fireEvent.change(screen.getByLabelText('Sala'), {
      target: { value: '101' },
    });

    const eventForm = document.querySelector('.event-form');
    expect(eventForm).not.toBeNull();
    if (!eventForm) {
      throw new Error('Event form was not rendered');
    }

    fireEvent.submit(eventForm);

    const storedValue = window.localStorage.getItem('mruos-calendar-v1');
    expect(storedValue).not.toBeNull();
    const parsedBackup = CalendarBackupSchema.parse(
      JSON.parse(storedValue ?? 'null') as unknown,
    );
    expect(
      parsedBackup.events.some(
        (series) => series.event.subject === 'LocalStorage test',
      ),
    ).toBe(true);

    firstRender.unmount();
    render(<App />);

    expect(screen.getByText('2027-02-01')).toBeTruthy();
  });

  it('migrates the current local plan to an empty account at first login', async () => {
    let migratedSubjects: string[] = [];
    let remoteSnapshot: unknown = {
      events: [],
      semester: { startDate: '2026-09-28', daysOff: [] },
    };
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return new Response(null, { status: 401 });
        }
        if (url.endsWith('/auth/login')) {
          return new Response(
            JSON.stringify({
              user: { id: 'user-1', email: 'student@example.com' },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/calendar') && init?.method === 'PUT') {
          remoteSnapshot = JSON.parse(String(init.body)) as unknown;
          const parsed = CalendarSnapshotSchema.parse(remoteSnapshot);
          migratedSubjects = parsed.events.map(
            (series) => series.event.subject,
          );
          return new Response(JSON.stringify(remoteSnapshot), { status: 200 });
        }
        if (url.endsWith('/calendar')) {
          return new Response(JSON.stringify(remoteSnapshot), { status: 200 });
        }

        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal('fetch', fetcher);

    render(<App />);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj zajęcia' }));
    fireEvent.change(screen.getByLabelText('Przedmiot'), {
      target: { value: 'Migrated plan' },
    });
    fireEvent.change(screen.getByLabelText('Budynek'), {
      target: { value: 'Wydział Testowy' },
    });
    fireEvent.change(screen.getByLabelText('Sala'), {
      target: { value: '202' },
    });
    const eventForm = document.querySelector('.event-form');
    expect(eventForm).not.toBeNull();
    if (!eventForm) {
      throw new Error('Event form was not rendered');
    }
    fireEvent.submit(eventForm);

    await waitFor(() =>
      expect(
        CalendarBackupSchema.parse(
          JSON.parse(
            window.localStorage.getItem('mruos-calendar-v1') ?? 'null',
          ),
        ).events.some((series) => series.event.subject === 'Migrated plan'),
      ).toBe(true),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Hasło'), {
      target: { value: 'correct-horse-battery' },
    });
    const accountForm = document.querySelector('.account-modal form');
    expect(accountForm).not.toBeNull();
    if (!accountForm) {
      throw new Error('Account form was not rendered');
    }
    fireEvent.submit(accountForm);

    await waitFor(() => expect(migratedSubjects).toContain('Migrated plan'));
    expect(window.localStorage.getItem('mruos-calendar-v1:migrated')).toBe(
      'true',
    );
  });

  it('does not move the local plan again to an empty account', async () => {
    window.localStorage.setItem(
      'mruos-calendar-v1',
      JSON.stringify({
        version: 1,
        events: [],
        semester: { startDate: '2027-02-01', daysOff: [] },
      }),
    );
    window.localStorage.setItem('mruos-calendar-v1:migrated', 'true');
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/auth/me')) {
          return new Response(
            JSON.stringify({
              user: { id: 'user-2', email: 'other@example.com' },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/calendar') && init?.method === undefined) {
          return new Response(
            JSON.stringify({
              events: [],
              semester: { startDate: '2026-09-28', daysOff: [] },
            }),
            { status: 200 },
          );
        }

        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('other@example.com')).toBeTruthy(),
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(
      false,
    );
  });
});
