import { describe, expect, it } from 'vitest';
import { exportCalendarBackup, importCalendarBackup } from './calendarBackup';
import type { CalendarSnapshot } from './eventRepository';

const snapshot: CalendarSnapshot = {
  events: [
    {
      id: 'series-1',
      event: {
        kind: 'class',
        subject: 'Matematyka',
        classType: 'wyklad',
        color: '#25745b',
        building: 'Wydział Matematyki',
        room: '204',
        startTime: '08:00',
        endTime: '10:00',
        timezone: 'Europe/Warsaw',
        recurrence: {
          freq: 'WEEKLY',
          interval: 1,
          byDay: ['MO'],
          startDate: '2026-10-05',
          endDate: '2026-11-02',
        },
        exceptions: [],
      },
    },
  ],
  semester: { startDate: '2026-09-28', daysOff: ['2026-11-11'] },
};

describe('calendar backup', () => {
  it('exports and imports the complete versioned calendar snapshot', () => {
    const serialized = exportCalendarBackup(snapshot);

    expect(JSON.parse(serialized)).toMatchObject({ version: 1 });
    expect(importCalendarBackup(serialized)).toEqual({
      success: true,
      value: snapshot,
    });
  });

  it('rejects malformed JSON and unsupported backup versions', () => {
    expect(importCalendarBackup('{broken')).toEqual({
      success: false,
      error: 'invalid-data',
    });
    expect(importCalendarBackup(JSON.stringify({ version: 2 }))).toEqual({
      success: false,
      error: 'invalid-data',
    });
  });
});
