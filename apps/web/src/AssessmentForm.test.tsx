import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventSchema } from '@mruos/shared';
import type { Assessment, EventSeries } from '@mruos/shared';
import { AssessmentForm } from './AssessmentForm';

const series: EventSeries[] = [
  {
    id: 'maths',
    event: EventSchema.parse({
      kind: 'class',
      subject: 'Matematyka',
      classType: 'cwiczenia',
      color: '#3b82f6',
      building: 'Wydział Matematyki',
      room: '204',
      startTime: '08:00',
      endTime: '09:30',
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2027-01-25',
      },
      exceptions: [],
    }),
  },
];

function renderForm(onSave = vi.fn<(assessment: Assessment) => void>()) {
  render(
    <AssessmentForm
      mode="create"
      kind="test"
      context={{ date: '2026-10-12' }}
      series={series}
      semester={{ daysOff: [] }}
      onCancel={vi.fn()}
      onSave={onSave}
    />,
  );
  return onSave;
}

function setValue(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('AssessmentForm', () => {
  afterEach(cleanup);

  it('offers the subject’s class on that day', () => {
    const onSave = renderForm();

    expect(
      (screen.getByLabelText('W czasie zajęć') as HTMLInputElement).disabled,
    ).toBe(true);
    setValue('Przedmiot', 'Matematyka');
    expect(
      (screen.getByLabelText('W czasie zajęć') as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByLabelText('Zajęcia').textContent).toBe(
      'Ćwiczenia 08:00–09:30, sala 204',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: {
          type: 'class',
          classType: 'cwiczenia',
          date: '2026-10-12',
          startTime: '08:00',
        },
      }),
    );
  });

  it('turns into an exam with its own time and reminders', () => {
    const onSave = renderForm();

    fireEvent.click(screen.getByLabelText('Egzamin'));
    setValue('Przedmiot', 'Matematyka');
    setValue('Data', '2027-02-08');
    fireEvent.click(screen.getByLabelText('2 godziny wcześniej'));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave).toHaveBeenCalledWith({
      kind: 'exam',
      subject: 'Matematyka',
      title: 'Egzamin',
      reminders: ['P7D', 'P1D', 'PT2H'],
      anchor: {
        type: 'own',
        date: '2027-02-08',
        startTime: '09:00',
        endTime: '10:30',
        building: 'Wydział Matematyki',
        room: '204',
      },
    });
  });

  it('shows what is missing instead of saving', () => {
    const onSave = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Podaj przedmiot.');
  });
});
