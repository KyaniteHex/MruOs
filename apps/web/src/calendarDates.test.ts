import { describe, expect, it } from 'vitest';
import type { Semester } from '@mruos/shared';
import {
  calendarTitle,
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
