import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CalendarBackupSchema } from '@mruos/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
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
});
