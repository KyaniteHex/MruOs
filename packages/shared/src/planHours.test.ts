import { describe, expect, it } from 'vitest';
import { planHours } from './planHours.js';
import { EntryRecordSchema, EventSchema } from './schemas.js';

function series(
  startTime: string,
  endTime: string,
  exceptions: unknown[] = [],
) {
  return {
    id: `${startTime}-${endTime}`,
    event: EventSchema.parse({
      kind: 'class',
      subject: 'Matematyka',
      classType: 'wyklad',
      color: '#25745b',
      building: 'Wydział Matematyki',
      room: '204',
      startTime,
      endTime,
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2027-01-25',
      },
      exceptions,
    }),
  };
}

describe('planHours', () => {
  it('fits the earliest start and the latest end in whole hours', () => {
    expect(
      planHours([series('08:15', '09:45'), series('13:00', '16:15')]),
    ).toEqual({ start: 8, end: 17 });
  });

  it('includes single-day changes and kolokwia at their own time', () => {
    const exam = EntryRecordSchema.parse({
      id: 'exam',
      entry: {
        kind: 'exam',
        subject: 'Matematyka',
        title: 'Egzamin',
        reminders: [],
        anchor: {
          type: 'own',
          date: '2027-02-08',
          startTime: '07:30',
          endTime: '09:00',
        },
      },
    });

    expect(
      planHours(
        [
          series('09:00', '11:00', [
            { date: '2026-10-12', override: { endTime: '18:30' } },
          ]),
        ],
        [exam],
      ),
    ).toEqual({ start: 7, end: 19 });
  });

  it('shows at least six hours, and a working day for an empty plan', () => {
    expect(planHours([series('10:00', '11:30')])).toEqual({
      start: 10,
      end: 16,
    });
    expect(planHours([])).toEqual({ start: 8, end: 16 });
  });
});
