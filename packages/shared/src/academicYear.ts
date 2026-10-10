import { DateTime } from 'luxon';
import { semesterWeekRange } from './semester.js';
import type {
  AcademicPeriodKind,
  AcademicSemester,
  AcademicTerm,
  AcademicYear,
  DateRange,
  Semester,
  Weekday,
} from './types.js';

const zone = 'Europe/Warsaw';

const weekdayNumbers: Record<Weekday, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

function isoDate(value: DateTime): string {
  return value.toISODate() ?? '';
}

function datesInRange(startDate: string, endDate: string): DateTime[] {
  const dates: DateTime[] = [];
  const end = DateTime.fromISO(endDate, { zone });
  for (
    let day = DateTime.fromISO(startDate, { zone });
    day <= end;
    day = day.plus({ days: 1 })
  ) {
    dates.push(day);
  }

  return dates;
}

export function findSemester(
  year: AcademicYear,
  term: AcademicTerm,
): AcademicSemester | undefined {
  return year.semesters.find((semester) => semester.term === term);
}

/** The term whose dates contain `date`, if any. */
export function termForDate(
  year: AcademicYear,
  date: string,
): AcademicTerm | null {
  return (
    year.semesters.find(
      (semester) => semester.startDate <= date && date <= semester.endDate,
    )?.term ?? null
  );
}

/** Dates without classes: listed days off and every day of day-off periods. */
export function academicYearDaysOff(year: AcademicYear): string[] {
  const dates = new Set(year.daysOff.map((dayOff) => dayOff.date));
  for (const semester of year.semesters) {
    for (const period of semester.periods.filter((p) => p.kind === 'day-off')) {
      datesInRange(period.startDate, period.endDate).forEach((day) =>
        dates.add(isoDate(day)),
      );
    }
  }

  return [...dates].sort();
}

/**
 * Semester settings derived from the calendar: all days off, and the start
 * of the semester in progress on `today` (or the next one, or the last one).
 */
export function semesterFromAcademicYear(
  year: AcademicYear,
  today: string,
): Semester {
  const semesters = [...year.semesters].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
  const current =
    semesters.find(
      (semester) => semester.startDate <= today && today <= semester.endDate,
    ) ??
    semesters.find((semester) => semester.startDate > today) ??
    semesters.at(-1);

  return {
    startDate: current?.startDate ?? `${year.startYear}-10-01`,
    daysOff: academicYearDaysOff(year),
    academicYear: year,
  };
}

/** Dates of `weekday` inside the teaching periods of a semester, in order. */
export function teachingDates(
  year: AcademicYear,
  term: AcademicTerm,
  weekday: Weekday,
): string[] {
  const periods = (findSemester(year, term)?.periods ?? [])
    .filter((period) => period.kind === 'teaching')
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  return periods.flatMap((period) =>
    datesInRange(period.startDate, period.endDate)
      .filter((day) => day.weekday === weekdayNumbers[weekday])
      .map(isoDate),
  );
}

/** Date of semester week `week` for a class held on `weekday`. */
export type WeekCalendar = (week: number, weekday: Weekday) => string | null;

/**
 * Week N of a class is its N-th date within the teaching periods. A day off
 * inside a teaching period still counts as a week; the class is cancelled.
 */
export function academicWeekCalendar(
  year: AcademicYear,
  term: AcademicTerm,
): WeekCalendar {
  const cache = new Map<Weekday, string[]>();

  return (week, weekday) => {
    const dates = cache.get(weekday) ?? teachingDates(year, term, weekday);
    cache.set(weekday, dates);

    return dates[week - 1] ?? null;
  };
}

/** Without a calendar: 7-day windows from the semester start. */
export function semesterWeekCalendar(
  semester: Pick<Semester, 'startDate'> & Partial<Pick<Semester, 'daysOff'>>,
): WeekCalendar {
  return (week, weekday) => {
    try {
      const window = DateTime.fromISO(
        semesterWeekRange(semester, week).startDate,
        { zone },
      );
      return isoDate(
        window.plus({
          days: (weekdayNumbers[weekday] - window.weekday + 7) % 7,
        }),
      );
    } catch {
      return null;
    }
  };
}

/** Dates spanning weeks `first`..`last` for classes held on `byDay`. */
export function weeksToDateRange(
  calendar: WeekCalendar,
  byDay: readonly Weekday[],
  first: number,
  last: number,
): DateRange | null {
  const starts = byDay.map((weekday) => calendar(first, weekday));
  const ends = byDay.map((weekday) => calendar(last, weekday));
  if (
    byDay.length === 0 ||
    starts.some((date) => date === null) ||
    ends.some((date) => date === null)
  ) {
    return null;
  }

  return {
    startDate: (starts as string[]).sort()[0] ?? '',
    endDate: (ends as string[]).sort().at(-1) ?? '',
  };
}

export type CalendarAnnotation = {
  kind: Exclude<AcademicPeriodKind, 'teaching'>;
  label: string;
  startDate: string;
  endDate: string;
};

/** Breaks, exams, events and days off to show in the calendar. */
export function academicAnnotations(year: AcademicYear): CalendarAnnotation[] {
  const periods = year.semesters.flatMap((semester) =>
    semester.periods.flatMap((period) =>
      period.kind === 'teaching'
        ? []
        : [
            {
              kind: period.kind,
              label: period.label,
              startDate: period.startDate,
              endDate: period.endDate,
            },
          ],
    ),
  );
  const daysOff = year.daysOff.map((dayOff) => ({
    kind: 'day-off' as const,
    label: dayOff.label,
    startDate: dayOff.date,
    endDate: dayOff.date,
  }));

  return [...periods, ...daysOff].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
}

/**
 * Days off, breaks, exams and events of a semester. Without an academic
 * calendar its days off get a generic name.
 */
export function semesterAnnotations(semester: Semester): CalendarAnnotation[] {
  return semester.academicYear
    ? academicAnnotations(semester.academicYear)
    : semester.daysOff.map((date) => ({
        kind: 'day-off',
        label: 'Dzień wolny',
        startDate: date,
        endDate: date,
      }));
}

/** Today's date in the app's time zone. */
export function todayInWarsaw(): string {
  return isoDate(DateTime.now().setZone(zone));
}

/** The academic year in progress on `date`; September already belongs to the next one. */
export function academicStartYear(date: string): number {
  const day = DateTime.fromISO(date, { zone });

  return day.month >= 9 ? day.year : day.year - 1;
}

/** The date after `date`, e.g. the exclusive end of an all-day period. */
export function dayAfter(date: string): string {
  return isoDate(DateTime.fromISO(date, { zone }).plus({ days: 1 }));
}
