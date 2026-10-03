import { describe, expect, it } from 'vitest';
import {
  datesBetween,
  semesterWeekRange,
  semesterWeeksToDateRange,
} from './semester.js';

describe('semesterWeeksToDateRange', () => {
  const semester = { startDate: '2026-09-28' };

  it('converts inclusive semester weeks into an inclusive date range', () => {
    expect(semesterWeeksToDateRange(semester, 1, 6)).toEqual({
      startDate: '2026-09-28',
      endDate: '2026-11-08',
    });
  });

  it('maps week 7 to the day after week 6 ends', () => {
    const previousClass = semesterWeeksToDateRange(semester, 1, 6);
    const nextClass = semesterWeeksToDateRange(semester, 7, 12);

    expect(previousClass.endDate).toBe('2026-11-08');
    expect(nextClass.startDate).toBe('2026-11-09');
  });

  it('rejects invalid week numbers', () => {
    expect(() => semesterWeeksToDateRange(semester, 0, 2)).toThrow(RangeError);
    expect(() => semesterWeeksToDateRange(semester, 3, 2)).toThrow(RangeError);
  });

  it('skips weeks whose working days are all days off', () => {
    const winterBreak = [
      '2026-12-21',
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-25',
    ];
    const withBreak = { startDate: '2026-10-05', daysOff: winterBreak };

    expect(semesterWeekRange(withBreak, 11)).toEqual({
      startDate: '2026-12-14',
      endDate: '2026-12-20',
    });
    expect(semesterWeekRange(withBreak, 12)).toEqual({
      startDate: '2026-12-28',
      endDate: '2027-01-03',
    });
    expect(semesterWeeksToDateRange(withBreak, 11, 12)).toEqual({
      startDate: '2026-12-14',
      endDate: '2027-01-03',
    });
  });

  it('keeps counting weeks with only some days off', () => {
    const withHoliday = { startDate: '2026-10-05', daysOff: ['2026-11-11'] };

    expect(semesterWeekRange(withHoliday, 6)).toEqual(
      semesterWeekRange({ startDate: '2026-10-05' }, 6),
    );
  });
});

describe('datesBetween', () => {
  it('lists every date of a break, including both ends', () => {
    expect(datesBetween('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('returns nothing for reversed, invalid or overly long ranges', () => {
    expect(datesBetween('2027-01-02', '2026-12-30')).toEqual([]);
    expect(datesBetween('nie-data', '2026-12-30')).toEqual([]);
    expect(datesBetween('2026-01-01', '2026-12-31')).toEqual([]);
  });
});
