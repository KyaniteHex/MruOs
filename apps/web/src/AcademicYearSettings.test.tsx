import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AcademicYear } from '@mruos/shared';
import { AcademicYearSettings } from './AcademicYearSettings';

function renderSettings(onSave = vi.fn<(year: AcademicYear) => void>()) {
  render(
    <AcademicYearSettings
      semester={{ startDate: '2026-09-28', daysOff: [] }}
      today="2026-10-04"
      onCancel={vi.fn()}
      onSave={onSave}
    />,
  );

  return onSave;
}

function setValue(label: string, value: string, index = 0) {
  const field = screen.getAllByLabelText(label)[index];
  if (!field) throw new Error(`Missing field ${label}`);
  fireEvent.change(field, { target: { value } });
}

describe('AcademicYearSettings', () => {
  afterEach(cleanup);

  it('lets the student edit, remove and add days off', () => {
    const onSave = renderSettings();

    // Only the days off are filled in; empty semesters are not saved.
    setValue('Opis dnia wolnego 2', 'Święto Niepodległości');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Usuń dzień wolny: Wigilia Bożego Narodzenia',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj dzień wolny' }));
    setValue('Data: dzień 14', '2026-11-02');
    setValue('Opis dnia wolnego 14', 'Dzień rektorski');
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz harmonogram' }));

    const [year] = onSave.mock.calls[0] ?? [];
    expect(year?.semesters).toEqual([]);
    expect(year?.daysOff).toHaveLength(14);
    expect(year?.daysOff).toContainEqual({
      date: '2026-11-11',
      label: 'Święto Niepodległości',
    });
    expect(year?.daysOff).toContainEqual({
      date: '2026-11-02',
      label: 'Dzień rektorski',
    });
    expect(year?.daysOff.map((day) => day.date)).not.toContain('2026-12-24');
  });

  it('explains what is missing instead of saving', () => {
    const onSave = renderSettings();

    setValue('Semestr zimowy: od', '2026-10-01');
    setValue('Semestr zimowy: do', '2027-02-21');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Usuń pozycję: Inauguracja roku akademickiego',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz harmonogram' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'Semestr zimowy, „Zajęcia dydaktyczne”: uzupełnij datę lub usuń pozycję.',
    );
    expect(screen.getByRole('alert').textContent).not.toContain('Inauguracja');
  });
});
