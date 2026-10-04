import { DateTime } from 'luxon';
import type { DateRange, Semester } from './types.js';

type SemesterWeeks = Pick<Semester, 'startDate'> &
  Partial<Pick<Semester, 'daysOff'>>;

// Generous upper bound on 7-day windows scanned, including long breaks.
const maxWindows = 104;

function semesterStart(semester: SemesterWeeks): DateTime {
  const start = DateTime.fromISO(semester.startDate, { zone: 'Europe/Warsaw' });

  if (!start.isValid) {
    throw new RangeError('Semester startDate must be a valid ISO date');
  }

  return start;
}

// A 7-day window is a break when every working day in it is a day off,
// e.g. the winter holidays. Timetables number only teaching weeks.
function isBreakWindow(windowStart: DateTime, daysOff: ReadonlySet<string>) {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = windowStart.plus({ days: offset });
    if (day.weekday <= 5 && !daysOff.has(day.toISODate() ?? '')) {
      return false;
    }
  }

  return true;
}

/**
 * Dates of teaching week `week` (1-based): consecutive 7-day windows from
 * the semester start, skipping windows that are entirely days off.
 */
export function semesterWeekRange(
  semester: SemesterWeeks,
  week: number,
): DateRange {
  if (!Number.isInteger(week) || week < 1) {
    throw new RangeError('Week numbers must be positive integers');
  }

  const start = semesterStart(semester);
  const daysOff = new Set(semester.daysOff ?? []);
  let teachingWeek = 0;

  for (let window = 0; window < maxWindows; window += 1) {
    const windowStart = start.plus({ days: window * 7 });
    if (isBreakWindow(windowStart, daysOff)) {
      continue;
    }
    teachingWeek += 1;
    if (teachingWeek === week) {
      return {
        startDate: windowStart.toISODate() ?? '',
        endDate: windowStart.plus({ days: 6 }).toISODate() ?? '',
      };
    }
  }

  throw new RangeError(`Week ${week} is beyond the supported semester length`);
}

export function semesterWeeksToDateRange(
  semester: SemesterWeeks,
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

  return {
    startDate: semesterWeekRange(semester, firstWeek).startDate,
    endDate: semesterWeekRange(semester, lastWeek).endDate,
  };
}

// Longest break the settings accept at once, as a guard against typos.
const maxBreakDays = 120;

/** All dates from `startDate` to `endDate` inclusive, e.g. a winter break. */
export function datesBetween(startDate: string, endDate: string): string[] {
  const start = DateTime.fromISO(startDate, { zone: 'Europe/Warsaw' });
  const end = DateTime.fromISO(endDate, { zone: 'Europe/Warsaw' });
  const days = Math.round(end.diff(start, 'days').days);

  if (!start.isValid || !end.isValid || days < 0 || days >= maxBreakDays) {
    return [];
  }

  return Array.from(
    { length: days + 1 },
    (_, offset) => start.plus({ days: offset }).toISODate() ?? '',
  );
}
