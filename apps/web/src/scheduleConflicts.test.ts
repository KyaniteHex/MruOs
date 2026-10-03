import { describe, expect, it } from 'vitest';
import { EventSchema } from '@mruos/shared';
import { findScheduleConflicts } from './scheduleConflicts';

function makeEvent(subject: string, startTime: string, endTime: string) {
  return EventSchema.parse({
    kind: 'class',
    subject,
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
      endDate: '2026-10-19',
    },
  });
}

describe('findScheduleConflicts', () => {
  const range = { startDate: '2026-10-05', endDate: '2026-10-19' };

  it('finds overlapping occurrences by date and time', () => {
    const conflicts = findScheduleConflicts(
      makeEvent('Nowe zajęcia', '09:00', '11:00'),
      [{ id: 'existing', event: makeEvent('Matematyka', '08:00', '10:00') }],
      range,
      { daysOff: [] },
    );

    expect(conflicts).toHaveLength(3);
    expect(conflicts[0]).toMatchObject({
      date: '2026-10-05',
      subject: 'Matematyka',
      startTime: '08:00',
      endTime: '10:00',
    });
  });

  it('does not treat adjacent or excluded series as conflicts', () => {
    const candidate = makeEvent('Nowe zajęcia', '10:00', '11:00');
    const series = [
      { id: 'existing', event: makeEvent('Matematyka', '08:00', '10:00') },
    ];

    expect(
      findScheduleConflicts(candidate, series, range, { daysOff: [] }),
    ).toEqual([]);
    expect(
      findScheduleConflicts(
        candidate,
        series,
        range,
        { daysOff: [] },
        'existing',
      ),
    ).toEqual([]);
  });

  it('ignores semester days off', () => {
    const singleDayRange = {
      startDate: '2026-10-05',
      endDate: '2026-10-05',
    };
    const event = makeEvent('Zajęcia', '09:00', '11:00');

    expect(
      findScheduleConflicts(
        event,
        [{ id: 'existing', event }],
        singleDayRange,
        { daysOff: ['2026-10-05'] },
        undefined,
      ),
    ).toEqual([]);
  });
});
