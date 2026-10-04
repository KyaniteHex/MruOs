import { describe, expect, it } from 'vitest';
import type { Event } from '@mruos/shared';
import { buildSlotIndex, findEntryConflicts } from './importConflicts';

function lab(
  subject: string,
  startTime: string,
  endTime: string,
  startDate: string,
  endDate: string,
): Event {
  return {
    kind: 'class',
    subject,
    classType: 'laboratorium',
    color: '#39789a',
    building: 'Jagiellońska 13',
    room: '12',
    startTime,
    endTime,
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: 1,
      byDay: ['MO'],
      startDate,
      endDate,
    },
    exceptions: [],
  };
}

const semester = { daysOff: ['2026-11-16'] };

describe('findEntryConflicts', () => {
  it('reports only the dates on which both classes take place', () => {
    // Weeks 6-15 vs weeks 7-15 of a semester starting on 2026-10-05.
    const biopharmacy = lab(
      'Biofarmacja',
      '11:30',
      '15:15',
      '2026-11-09',
      '2027-01-11',
    );
    const pharmacotherapy = lab(
      'Farmakoterapia',
      '12:00',
      '14:05',
      '2026-11-16',
      '2027-01-11',
    );
    const index = buildSlotIndex(
      [{ id: 'bio', event: biopharmacy, existing: false }],
      semester,
    );

    const [conflict, ...others] = findEntryConflicts(
      'pharma',
      pharmacotherapy,
      index,
      semester,
    );

    expect(others).toEqual([]);
    expect(conflict).toMatchObject({
      id: 'bio',
      subject: 'Biofarmacja',
      startTime: '11:30',
      endTime: '15:15',
      existing: false,
    });
    // 16.11 is a day off, so the first shared date is 23.11.
    expect(conflict?.dates[0]).toBe('2026-11-23');
    expect(conflict?.dates).toHaveLength(8);
  });

  it('ignores back-to-back classes and the class itself', () => {
    const morning = lab('Rano', '08:00', '10:00', '2026-10-05', '2026-10-26');
    const later = lab('Później', '10:00', '12:00', '2026-10-05', '2026-10-26');
    const index = buildSlotIndex(
      [
        { id: 'morning', event: morning, existing: true },
        { id: 'later', event: later, existing: false },
      ],
      semester,
    );

    expect(findEntryConflicts('later', later, index, semester)).toEqual([]);
  });
});
