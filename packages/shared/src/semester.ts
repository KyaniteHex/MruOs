import { DateTime } from 'luxon';
import type { DateRange, Semester } from './types.js';

export function semesterWeeksToDateRange(
  semester: Pick<Semester, 'startDate'>,
  firstWeek: number,
  lastWeek: number,
): DateRange {
  if (
    !Number.isInteger(firstWeek) ||
    !Number.isInteger(lastWeek) ||
    firstWeek < 1 ||
    lastWeek < firstWeek
  ) {
    throw new RangeError('Week numbers must be positive integers in order');
  }

  const semesterStart = DateTime.fromISO(semester.startDate, {
    zone: 'Europe/Warsaw',
  });

  if (!semesterStart.isValid) {
    throw new RangeError('Semester startDate must be a valid ISO date');
  }

  const startDate = semesterStart.plus({ days: (firstWeek - 1) * 7 });
  const endDate = semesterStart.plus({ days: lastWeek * 7 - 1 });

  return {
    startDate: startDate.toISODate() ?? '',
    endDate: endDate.toISODate() ?? '',
  };
}
