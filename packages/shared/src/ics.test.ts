import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { calendarIcs, defaultFeedOptions } from './ics.js';
import { EntryRecordSchema, EventSchema } from './schemas.js';
import type {
  CalendarFeedOptions,
  CalendarSnapshot,
  EventSeries,
  Semester,
} from './types.js';

const everything: CalendarFeedOptions = {
  assessments: true,
  notes: true,
  daysOff: true,
  periods: true,
};
const nothing: CalendarFeedOptions = {
  assessments: false,
  notes: false,
  daysOff: false,
  periods: false,
};

function makeEvent(
  startDate: string,
  endDate: string,
  exceptions: unknown[] = [],
) {
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
    exceptions,
  });
}

function snapshot(
  events: EventSeries[],
  entries: unknown[] = [],
  semester: Semester = { startDate: '2026-09-28', daysOff: [] },
): CalendarSnapshot {
  return {
    events,
    semester,
    entries: entries.map((record) => EntryRecordSchema.parse(record)),
  };
}

function vevents(content: string) {
  return new ICAL.Component(ICAL.parse(content)).getAllSubcomponents('vevent');
}

function text(event: ICAL.Component | undefined, property: string): string {
  return String(event?.getFirstPropertyValue(property));
}

describe('calendarIcs', () => {
  it('keeps Warsaw wall time across the change of time', () => {
    const content = calendarIcs(
      snapshot([
        { id: 'series-1', event: makeEvent('2026-10-19', '2026-11-02') },
      ]),
      nothing,
    );
    const events = vevents(content);

    expect(content).toContain('X-WR-CALNAME:MruOS');
    expect(events.map((event) => text(event, 'dtstart'))).toEqual([
      '2026-10-19T06:00:00Z',
      '2026-10-26T07:00:00Z',
      '2026-11-02T07:00:00Z',
    ]);
    expect(text(events[0], 'location')).toBe('Wydział Matematyki, 204');
    expect(text(events[0], 'description')).toBe('Typ zajęć: Wykład');
  });

  it('leaves out cancelled classes and days off', () => {
    const events = vevents(
      calendarIcs(
        snapshot(
          [
            {
              id: 'series-2',
              event: makeEvent('2026-10-05', '2026-10-19', [
                { date: '2026-10-05', status: 'cancelled' },
              ]),
            },
          ],
          [],
          { startDate: '2026-09-28', daysOff: ['2026-10-12'] },
        ),
        nothing,
      ),
    );

    expect(events.map((event) => text(event, 'dtstart'))).toEqual([
      '2026-10-19T06:00:00Z',
    ]);
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
      [
        {
          id: 'test',
          entry: {
            kind: 'test',
            subject: 'Matematyka',
            title: 'Kolokwium',
            details: 'z udostępnionych prezentacji',
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

    it('makes a kolokwium during a class part of that class', () => {
      const [withTest, otherWeek, exam] = vevents(
        calendarIcs(plan, defaultFeedOptions),
      );

      expect(text(withTest, 'summary')).toBe('⚑ Matematyka · Kolokwium');
      expect(text(withTest, 'description')).toBe(
        'Typ zajęć: Wykład\nKolokwium: z udostępnionych prezentacji',
      );
      expect(
        withTest
          ?.getAllSubcomponents('valarm')
          .map((alarm) => text(alarm, 'trigger')),
      ).toEqual(['-P1D', '-PT2H']);
      expect(text(otherWeek, 'summary')).toBe('Matematyka');
      expect(otherWeek?.getAllSubcomponents('valarm')).toEqual([]);

      expect(text(exam, 'summary')).toBe('★ Egzamin: Matematyka');
      expect(text(exam, 'location')).toBe('Aula');
      expect(text(exam, 'dtstart')).toBe('2027-02-08T08:00:00Z');
      expect(
        exam
          ?.getAllSubcomponents('valarm')
          .map((alarm) => text(alarm, 'trigger')),
      ).toEqual(['-P7D']);
    });

    it('adds notes to their classes only when asked', () => {
      const [withNote, otherWeek] = vevents(calendarIcs(plan, everything));

      expect(text(withNote, 'description')).toBe(
        'Typ zajęć: Wykład\nKolokwium: z udostępnionych prezentacji\nNotatka: Przynieść kalkulator\nNotatka do przedmiotu: Egzamin pisemny',
      );
      expect(text(otherWeek, 'description')).toBe(
        'Typ zajęć: Wykład\nNotatka do przedmiotu: Egzamin pisemny',
      );
    });

    it('leaves kolokwia and exams out when not chosen', () => {
      const events = vevents(calendarIcs(plan, nothing));

      expect(events.map((event) => text(event, 'summary'))).toEqual([
        'Matematyka',
        'Matematyka',
      ]);
      expect(events[0]?.getAllSubcomponents('valarm')).toEqual([]);
    });
  });

  describe('with the academic calendar', () => {
    const semester: Semester = {
      startDate: '2026-10-01',
      daysOff: ['2026-11-11', '2026-12-23'],
      academicYear: {
        startYear: 2026,
        semesters: [
          {
            term: 'winter',
            startDate: '2026-10-01',
            endDate: '2027-02-21',
            periods: [
              {
                label: 'Zajęcia dydaktyczne',
                kind: 'teaching',
                startDate: '2026-10-01',
                endDate: '2026-12-20',
              },
              {
                label: 'Wakacje zimowe',
                kind: 'break',
                startDate: '2026-12-21',
                endDate: '2027-01-06',
              },
            ],
          },
        ],
        daysOff: [
          { date: '2026-11-11', label: 'Narodowe Święto Niepodległości' },
        ],
      },
    };

    it('adds days off and periods as all-day events when chosen', () => {
      const events = vevents(
        calendarIcs(snapshot([], [], semester), everything),
      );

      expect(
        events.map((event) => [
          text(event, 'summary'),
          text(event, 'dtstart'),
          text(event, 'dtend'),
          text(event, 'transp'),
        ]),
      ).toEqual([
        [
          'Dzień wolny: Narodowe Święto Niepodległości',
          '2026-11-11',
          '2026-11-12',
          'TRANSPARENT',
        ],
        ['Wakacje zimowe', '2026-12-21', '2027-01-07', 'TRANSPARENT'],
      ]);
    });

    it('leaves them out by default', () => {
      expect(
        vevents(calendarIcs(snapshot([], [], semester), defaultFeedOptions)),
      ).toEqual([]);
    });
  });
});
