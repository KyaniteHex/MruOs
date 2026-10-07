import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { EntryRecordSchema, EventSchema } from '@mruos/shared';
import type { EventSeries } from '@mruos/shared';
import { exportCalendarIcs } from './calendarIcs';

function snapshot(
  events: EventSeries[],
  daysOff: string[] = [],
  entries: unknown[] = [],
) {
  return {
    events,
    semester: { startDate: '2026-09-28', daysOff },
    entries: entries.map((record) => EntryRecordSchema.parse(record)),
  };
}

function vevents(content: string) {
  return new ICAL.Component(ICAL.parse(content)).getAllSubcomponents('vevent');
}

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
      snapshot([
        {
          id: 'series-1',
          event: makeEvent('2026-10-19', '2026-11-02'),
        },
      ]),
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
    expect(String(events[0]?.getFirstPropertyValue('description'))).toContain(
      'Typ zajęć: Wykład',
    );
  });

  it('omits cancelled occurrences and semester days off', () => {
    const event = EventSchema.parse({
      ...makeEvent('2026-10-05', '2026-10-19'),
      exceptions: [{ date: '2026-10-05', status: 'cancelled' }],
    });
    const content = exportCalendarIcs(
      snapshot([{ id: 'series-2', event }], ['2026-10-12']),
    );
    const calendar = new ICAL.Component(ICAL.parse(content));
    const events = calendar.getAllSubcomponents('vevent');

    expect(events).toHaveLength(1);
    expect(events[0]?.getFirstPropertyValue('dtstart')?.toString()).toBe(
      '2026-10-19T06:00:00Z',
    );
  });

  describe('with kolokwia, exams and notes', () => {
    const duringClass = {
      type: 'class',
      classType: 'wyklad',
      date: '2026-10-19',
      startTime: '08:00',
    };
    const plan = snapshot(
      [{ id: 'series-1', event: makeEvent('2026-10-19', '2026-10-26') }],
      [],
      [
        {
          id: 'test',
          entry: {
            kind: 'test',
            subject: 'Matematyka',
            title: 'Kolokwium',
            details: 'Całki',
            reminders: ['P1D', 'PT2H'],
            anchor: duringClass,
          },
        },
        {
          id: 'exam',
          entry: {
            kind: 'exam',
            subject: 'Matematyka',
            title: 'Egzamin',
            reminders: ['P7D'],
            anchor: {
              type: 'own',
              date: '2027-02-08',
              startTime: '09:00',
              endTime: '11:00',
              room: 'Aula',
            },
          },
        },
        {
          id: 'note',
          entry: {
            kind: 'note',
            subject: 'Matematyka',
            text: 'Przynieść kalkulator',
            anchor: duringClass,
          },
        },
        {
          id: 'subject-note',
          entry: {
            kind: 'note',
            subject: 'Matematyka',
            text: 'Egzamin pisemny',
            anchor: { type: 'subject' },
          },
        },
      ],
    );

    it('adds kolokwia and exams with their reminders', () => {
      const events = vevents(exportCalendarIcs(plan));
      const [test, exam] = events.slice(2);

      expect(events).toHaveLength(4);
      expect(test?.getFirstPropertyValue('summary')).toBe(
        'Kolokwium: Matematyka',
      );
      expect(test?.getFirstPropertyValue('dtstart')?.toString()).toBe(
        '2026-10-19T06:00:00Z',
      );
      expect(String(test?.getFirstPropertyValue('description'))).toBe(
        'Kolokwium\nCałki',
      );
      expect(
        test
          ?.getAllSubcomponents('valarm')
          .map((alarm) => String(alarm.getFirstPropertyValue('trigger'))),
      ).toEqual(['-P1D', '-PT2H']);
      expect(exam?.getFirstPropertyValue('location')).toBe('Aula');
      expect(exam?.getFirstPropertyValue('dtstart')?.toString()).toBe(
        '2027-02-08T08:00:00Z',
      );
    });

    it('adds notes to the descriptions of their classes', () => {
      const [withNote, otherWeek] = vevents(exportCalendarIcs(plan));

      expect(String(withNote?.getFirstPropertyValue('description'))).toBe(
        'Typ zajęć: Wykład\nNotatka: Przynieść kalkulator\nNotatka do przedmiotu: Egzamin pisemny',
      );
      expect(String(otherWeek?.getFirstPropertyValue('description'))).toBe(
        'Typ zajęć: Wykład\nNotatka do przedmiotu: Egzamin pisemny',
      );
    });

    it('leaves out what was not chosen', () => {
      const events = vevents(
        exportCalendarIcs(plan, { assessments: false, notes: false }),
      );

      expect(events).toHaveLength(2);
      expect(String(events[0]?.getFirstPropertyValue('description'))).toBe(
        'Typ zajęć: Wykład',
      );
    });
  });
});
