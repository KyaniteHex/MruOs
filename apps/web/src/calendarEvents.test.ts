import { describe, expect, it } from 'vitest';
import { EntryRecordSchema, EventSchema, placeEntries } from '@mruos/shared';
import { toAssessmentEvents, toCalendarEvents } from './calendarEvents';

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

describe('entries in the calendar', () => {
  const maths = {
    id: 'maths',
    event: EventSchema.parse({
      kind: 'class',
      subject: 'Matematyka',
      classType: 'cwiczenia',
      color: '#bf6548',
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
        endDate: '2026-10-19',
      },
    }),
  };
  const duringClass = {
    type: 'class',
    classType: 'cwiczenia',
    date: '2026-10-12',
    startTime: '08:00',
  };
  const entries = [
    {
      id: 'test',
      entry: {
        kind: 'test',
        subject: 'Matematyka',
        title: 'Kolokwium',
        reminders: [],
        anchor: duringClass,
      },
    },
    {
      id: 'note',
      entry: {
        kind: 'note',
        subject: 'Matematyka',
        text: 'Kalkulator',
        anchor: duringClass,
      },
    },
    {
      id: 'exam',
      entry: {
        kind: 'exam',
        subject: 'Matematyka',
        title: 'Egzamin',
        reminders: [],
        anchor: {
          type: 'own',
          date: '2026-10-14',
          startTime: '10:00',
          endTime: '12:00',
          room: 'Aula',
        },
      },
    },
  ].map((record) => EntryRecordSchema.parse(record));
  const placed = placeEntries(entries, [maths], { daysOff: [] });
  const range = { startDate: '2026-10-05', endDate: '2026-10-19' };

  it('marks classes with a kolokwium or a note', () => {
    const events = toCalendarEvents([maths], range, undefined, placed);
    const marked = events.find((event) => event.id === 'maths-2026-10-12');
    const plain = events.find((event) => event.id === 'maths-2026-10-05');

    expect(marked?.classNames).toEqual(['has-test']);
    expect(marked?.extendedProps?.marks).toEqual({
      test: true,
      exam: false,
      note: true,
    });
    expect(plain?.classNames).toEqual([]);
  });

  it('shows assessments at their own time as separate blocks', () => {
    const [block, ...others] = toAssessmentEvents(placed.assessments, range);

    expect(others).toEqual([]);
    expect(block).toMatchObject({
      title: 'Egzamin: Matematyka',
      classNames: ['calendar-assessment', 'calendar-assessment-exam'],
      extendedProps: { assessmentId: 'exam', kind: 'exam', room: 'Aula' },
    });
    expect(String(block?.start)).toContain('2026-10-14T10:00:00');
    expect(
      toAssessmentEvents(placed.assessments, {
        startDate: '2026-10-15',
        endDate: '2026-10-31',
      }),
    ).toEqual([]);
  });
});
