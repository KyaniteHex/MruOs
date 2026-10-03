import { describe, expect, it } from 'vitest';
import { semesterWeeksToDateRange } from './semester.js';

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
});
