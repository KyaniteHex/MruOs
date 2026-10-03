import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SemesterSettings } from './SemesterSettings';

describe('SemesterSettings', () => {
  afterEach(cleanup);

  it('adds and removes days off before saving semester settings', () => {
    const onSave = vi.fn();

    render(
      <SemesterSettings
        semester={{ startDate: '2026-09-28', daysOff: [] }}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Dodaj dzień wolny'), {
      target: { value: '2026-11-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj dzień' }));
    expect(screen.getByText('2026-11-11')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Usuń dzień wolny 2026-11-11' }),
    );
    fireEvent.change(screen.getByLabelText('Dodaj dzień wolny'), {
      target: { value: '2026-12-25' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj dzień' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }));

    expect(onSave).toHaveBeenCalledWith({
      startDate: '2026-09-28',
      daysOff: ['2026-12-25'],
    });
  });

  it('adds a whole break as days off', () => {
    const onSave = vi.fn();

    render(
      <SemesterSettings
        semester={{ startDate: '2026-10-05', daysOff: ['2026-12-24'] }}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Przerwa od'), {
      target: { value: '2026-12-23' },
    });
    fireEvent.change(screen.getByLabelText('Przerwa do'), {
      target: { value: '2026-12-26' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj przerwę' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz ustawienia' }));

    expect(onSave).toHaveBeenCalledWith({
      startDate: '2026-10-05',
      daysOff: ['2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26'],
    });
  });
});
