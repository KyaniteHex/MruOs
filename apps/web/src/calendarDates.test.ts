import { describe, expect, it } from 'vitest';
import { EventSchema, placeEntries } from '@mruos/shared';
import type { Semester } from '@mruos/shared';
import {
  calendarTitle,
  isWeekend,
  planHasWeekend,
  startingDate,
  visibleDates,
  weekLabel,
} from './calendarDates';

const semester: Semester = { startDate: '2026-09-28', daysOff: [] };

describe('calendarTitle', () => {
  it('names months, weeks and days in Polish', () => {
    expect(calendarTitle('dayGridMonth', '2026-10-01', '2026-10-31')).toBe(
      'Październik 2026',
    );
    expect(calendarTitle('timeGridWeek', '2026-10-05', '2026-10-09')).toBe(
      '5–9 października 2026',
    );
    expect(calendarTitle('timeGridWeek', '2026-09-28', '2026-10-02')).toBe(
      '28 września – 2 października 2026',
    );
    expect(calendarTitle('timeGridWeek', '2026-12-28', '2027-01-01')).toBe(
      '28 grudnia 2026 – 1 stycznia 2027',
    );
    expect(calendarTitle('timeGridDay', '2026-10-05', '2026-10-05')).toBe(
      'Poniedziałek, 5 października 2026',
    );
  });
});

describe('isWeekend', () => {
  it('knows Saturdays and Sundays', () => {
    expect(
      ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'].map(isWeekend),
    ).toEqual([false, true, true, false]);
  });
});

describe('visibleDates', () => {
  it('drops the exclusive end', () => {
    expect(visibleDates('2026-10-05', '2026-10-08')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
  });
});

describe('weekLabel', () => {
  it('gives the teaching week of the dates shown', () => {
    expect(weekLabel(semester, visibleDates('2026-10-05', '2026-10-10'))).toBe(
      'tydzień 2 semestru',
    );
    expect(weekLabel(semester, ['2026-09-20'])).toBeNull();
  });

  it('shows a range when weekdays count different weeks', () => {
    const umk: Semester = {
      startDate: '2026-10-01',
      daysOff: [],
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
                startDate: '2026-10-02',
                endDate: '2026-12-20',
              },
            ],
          },
        ],
        daysOff: [],
      },
    };

    expect(weekLabel(umk, visibleDates('2026-10-05', '2026-10-10'))).toBe(
      'tydzień 1–2 semestru',
    );
  });
});

describe('startingDate', () => {
  it('opens on today during the semester', () => {
    expect(startingDate(semester, '2026-10-10')).toBe('2026-10-10');
  });

  it('opens on the semester start before or after it', () => {
    expect(startingDate(semester, '2026-09-01')).toBe('2026-09-28');
    expect(startingDate(semester, '2027-06-01')).toBe('2026-09-28');
  });
});

describe('planHasWeekend', () => {
  function onDays(byDay: string[]) {
    return {
      id: byDay.join(''),
      event: EventSchema.parse({
        kind: 'class',
        subject: 'Matematyka',
        classType: 'wyklad',
        color: '#25745b',
        building: 'A',
        room: '1',
        startTime: '08:00',
        endTime: '10:00',
        timezone: 'Europe/Warsaw',
        recurrence: {
          freq: 'WEEKLY',
          interval: 1,
          byDay,
          startDate: '2026-10-05',
          endDate: '2026-12-20',
        },
      }),
    };
  }

  it('looks for classes and exams on Saturdays and Sundays', () => {
    const exam = placeEntries(
      [
        {
          id: 'exam',
          entry: {
            kind: 'exam',
            subject: 'Matematyka',
            title: 'Egzamin',
            reminders: [],
            anchor: {
              type: 'own',
              date: '2027-02-06',
              startTime: '09:00',
              endTime: '11:00',
            },
          },
        },
      ],
      [],
      { daysOff: [] },
    ).assessments;

    expect(planHasWeekend([onDays(['MO', 'FR'])], [])).toBe(false);
    expect(planHasWeekend([onDays(['MO', 'SA'])], [])).toBe(true);
    expect(planHasWeekend([onDays(['MO'])], exam)).toBe(true);
  });
});
