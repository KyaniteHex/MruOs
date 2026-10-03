import { describe, expect, it } from 'vitest';
import { EventSchema } from '@mruos/shared';
import { toCalendarEvents } from './calendarEvents';

describe('toCalendarEvents', () => {
  it('maps expanded occurrences into FullCalendar events with local time and details', () => {
    const event = EventSchema.parse({
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
        endDate: '2026-10-05',
      },
    });

    const [calendarEvent] = toCalendarEvents([{ id: 'series-1', event }], {
      startDate: '2026-10-05',
      endDate: '2026-10-05',
    });

    expect(calendarEvent?.title).toBe('Matematyka');
    expect(String(calendarEvent?.start)).toContain('T08:00:00');
    expect(calendarEvent?.backgroundColor).toBe('#25745b');
    expect(calendarEvent?.textColor).toBe('#ffffff');
    expect(calendarEvent?.extendedProps).toEqual(
      expect.objectContaining({
        building: 'Wydział Matematyki',
        room: '204',
        startTime: '08:00',
        endTime: '10:00',
        seriesId: 'series-1',
        date: '2026-10-05',
      }),
    );
  });

  it('keeps cancelled occurrences and semester days off out of the calendar', () => {
    const event = EventSchema.parse({
      kind: 'class',
      subject: 'Fizyka',
      classType: 'wyklad',
      color: '#96703e',
      building: 'Budynek A',
      room: '1',
      startTime: '12:00',
      endTime: '14:00',
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['WE'],
        startDate: '2026-11-04',
        endDate: '2026-11-18',
      },
      exceptions: [{ date: '2026-11-04', status: 'cancelled' }],
    });

    const calendarEvents = toCalendarEvents(
      [{ id: 'series-2', event }],
      { startDate: '2026-11-04', endDate: '2026-11-18' },
      { daysOff: ['2026-11-11'] },
    );

    expect(calendarEvents.map((calendarEvent) => calendarEvent.start)).toEqual([
      expect.stringContaining('2026-11-18'),
    ]);
  });
});
