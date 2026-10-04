import { describe, expect, it } from 'vitest';
import {
  academicAnnotations,
  academicWeekCalendar,
  academicYearDaysOff,
  semesterFromAcademicYear,
  semesterWeekCalendar,
  teachingDates,
  termForDate,
  weeksToDateRange,
} from './academicYear.js';
import { polishPublicHolidays } from './holidays.js';
import type { AcademicYear } from './types.js';

// Nicolaus Copernicus University calendar for 2026/2027.
const umk: AcademicYear = {
  startYear: 2026,
  semesters: [
    {
      term: 'winter',
      startDate: '2026-10-01',
      endDate: '2027-02-21',
      periods: [
        {
          label: 'Inauguracja roku akademickiego',
          kind: 'event',
          startDate: '2026-10-01',
          endDate: '2026-10-01',
        },
        {
          label: 'Zajęcia dydaktyczne',
          kind: 'teaching',
          startDate: '2026-10-02',
          endDate: '2026-12-20',
        },
        {
          label: 'Wakacje zimowe',
          kind: 'break',
          startDate: '2026-12-21',
          endDate: '2027-01-06',
        },
        {
          label: 'Zajęcia dydaktyczne',
          kind: 'teaching',
          startDate: '2027-01-07',
          endDate: '2027-02-04',
        },
        {
          label: 'Egzaminacyjna sesja zimowa',
          kind: 'exams',
          startDate: '2027-02-05',
          endDate: '2027-02-18',
        },
        {
          label: 'Święto uczelni',
          kind: 'day-off',
          startDate: '2027-02-19',
          endDate: '2027-02-19',
        },
      ],
    },
    {
      term: 'summer',
      startDate: '2027-02-22',
      endDate: '2027-09-30',
      periods: [
        {
          label: 'Zajęcia dydaktyczne',
          kind: 'teaching',
          startDate: '2027-02-22',
          endDate: '2027-03-25',
        },
        {
          label: 'Wakacje wiosenne',
          kind: 'break',
          startDate: '2027-03-26',
          endDate: '2027-03-30',
        },
        {
          label: 'Zajęcia dydaktyczne',
          kind: 'teaching',
          startDate: '2027-03-31',
          endDate: '2027-06-15',
        },
      ],
    },
  ],
  daysOff: polishPublicHolidays(2026),
};

describe('academic week numbering', () => {
  it('counts the dates of a weekday within teaching periods only', () => {
    const tuesdays = teachingDates(umk, 'winter', 'TU');

    expect(tuesdays).toHaveLength(15);
    expect(tuesdays.slice(10)).toEqual([
      '2026-12-15',
      '2027-01-12',
      '2027-01-19',
      '2027-01-26',
      '2027-02-02',
    ]);
  });

  it('keeps a holiday inside a teaching period as a week', () => {
    const week = academicWeekCalendar(umk, 'winter');

    // The class on 11.11 is cancelled by the day off, not moved.
    expect(week(6, 'WE')).toBe('2026-11-11');
    expect(week(7, 'WE')).toBe('2026-11-18');
    expect(week(1, 'FR')).toBe('2026-10-02');
    expect(week(1, 'MO')).toBe('2026-10-05');
    expect(week(16, 'TU')).toBeNull();
  });

  it('numbers summer weeks from the summer teaching periods', () => {
    const week = academicWeekCalendar(umk, 'summer');

    expect(week(1, 'MO')).toBe('2027-02-22');
    // 29.03 is in the spring break, so week 6 is the next Monday.
    expect(week(5, 'MO')).toBe('2027-03-22');
    expect(week(6, 'MO')).toBe('2027-04-05');
  });

  it('turns week ranges into date ranges for the chosen weekdays', () => {
    expect(
      weeksToDateRange(
        academicWeekCalendar(umk, 'winter'),
        ['MO', 'TH'],
        1,
        15,
      ),
    ).toEqual({ startDate: '2026-10-05', endDate: '2027-02-01' });
    expect(
      weeksToDateRange(academicWeekCalendar(umk, 'winter'), ['TU'], 14, 16),
    ).toBeNull();
  });

  it('falls back to 7-day windows from the semester start', () => {
    const week = semesterWeekCalendar({ startDate: '2026-10-05' });

    expect(week(1, 'WE')).toBe('2026-10-07');
    expect(week(11, 'MO')).toBe('2026-12-14');
  });
});

describe('semester settings from the calendar', () => {
  it('cancels classes on holidays and day-off periods', () => {
    const daysOff = academicYearDaysOff(umk);

    expect(daysOff).toHaveLength(15);
    expect(daysOff).toContain('2026-11-11');
    expect(daysOff).toContain('2027-02-19');
  });

  it('starts at the semester in progress or the next one', () => {
    expect(semesterFromAcademicYear(umk, '2026-10-04')).toMatchObject({
      startDate: '2026-10-01',
      academicYear: umk,
    });
    expect(semesterFromAcademicYear(umk, '2027-03-10').startDate).toBe(
      '2027-02-22',
    );
    expect(semesterFromAcademicYear(umk, '2026-09-01').startDate).toBe(
      '2026-10-01',
    );
    expect(termForDate(umk, '2027-02-21')).toBe('winter');
    expect(termForDate(umk, '2027-02-22')).toBe('summer');
    expect(termForDate(umk, '2027-10-01')).toBeNull();
  });
});

describe('academicAnnotations', () => {
  it('lists breaks, exams, events and days off but not teaching periods', () => {
    const annotations = academicAnnotations(umk);

    expect(annotations).toHaveLength(19);
    expect(annotations[0]).toEqual({
      kind: 'event',
      label: 'Inauguracja roku akademickiego',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
    });
    expect(annotations).toContainEqual({
      kind: 'day-off',
      label: 'Narodowe Święto Niepodległości',
      startDate: '2026-11-11',
      endDate: '2026-11-11',
    });
    expect(annotations.some((a) => a.label === 'Zajęcia dydaktyczne')).toBe(
      false,
    );
  });
});
