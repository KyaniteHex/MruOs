import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { EventSchema } from '@mruos/shared';
import { exportCalendarIcs } from './calendarIcs';

function makeEvent(startDate: string, endDate: string) {
  return EventSchema.parse({
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
      startDate,
      endDate,
    },
  });
}

describe('exportCalendarIcs', () => {
  it('exports RFC 5545 events with UTC instants preserving Warsaw wall time', () => {
    const content = exportCalendarIcs(
      [
        {
          id: 'series-1',
          event: makeEvent('2026-10-19', '2026-11-02'),
        },
      ],
      [],
    );
    const calendar = new ICAL.Component(ICAL.parse(content));
    const events = calendar.getAllSubcomponents('vevent');

    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('END:VCALENDAR');
    expect(events).toHaveLength(3);
    expect(
      events.map((event) => event.getFirstPropertyValue('dtstart')?.toString()),
    ).toEqual([
      '2026-10-19T06:00:00Z',
      '2026-10-26T07:00:00Z',
      '2026-11-02T07:00:00Z',
    ]);
    expect(events[0]?.getFirstPropertyValue('location')).toBe(
      'Wydział Matematyki, 204',
    );
  });

  it('omits cancelled occurrences and semester days off', () => {
    const event = EventSchema.parse({
      ...makeEvent('2026-10-05', '2026-10-19'),
      exceptions: [{ date: '2026-10-05', status: 'cancelled' }],
    });
    const content = exportCalendarIcs(
      [{ id: 'series-2', event }],
      ['2026-10-12'],
    );
    const calendar = new ICAL.Component(ICAL.parse(content));
    const events = calendar.getAllSubcomponents('vevent');

    expect(events).toHaveLength(1);
    expect(events[0]?.getFirstPropertyValue('dtstart')?.toString()).toBe(
      '2026-10-19T06:00:00Z',
    );
  });
});
