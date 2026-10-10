import {
  classesOn,
  datesBetween,
  dayAfter,
  findSemester,
  semesterWeekNumber,
  semesterWeeksToDateRange,
  termForDate,
} from '@mruos/shared';
import type { EventSeries, ScheduledAssessment, Semester } from '@mruos/shared';

export type CalendarView = 'timeGridWeek' | 'dayGridMonth' | 'timeGridDay';

/** Dates shown between FullCalendar's start and its exclusive end. */
export function visibleDates(start: string, endExclusive: string): string[] {
  return datesBetween(start, endExclusive).slice(0, -1);
}

/** "tydzień 2 semestru", or "tydzień 1–2 semestru" when weekdays differ. */
export function weekLabel(
  semester: Semester,
  dates: readonly string[],
): string | null {
  const weeks = [
    ...new Set(
      dates
        .map((date) => semesterWeekNumber(semester, date))
        .filter((week): week is number => week !== null),
    ),
  ].sort((left, right) => left - right);
  const first = weeks[0];
  const last = weeks.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }

  return first === last
    ? `tydzień ${first} semestru`
    : `tydzień ${first}–${last} semestru`;
}

function semesterEnd(semester: Semester): string {
  const year = semester.academicYear;
  const term = year ? termForDate(year, semester.startDate) : null;
  const fromCalendar =
    year && term ? findSemester(year, term)?.endDate : undefined;

  return fromCalendar ?? semesterWeeksToDateRange(semester, 1, 20).endDate;
}

/** Today while the semester runs, otherwise the semester's first day. */
export function startingDate(semester: Semester, today: string): string {
  return today >= semester.startDate && today <= semesterEnd(semester)
    ? today
    : semester.startDate;
}

/** Saturday and Sunday of the week that starts on `monday`. */
export function weekendOf(monday: string): [string, string] {
  let saturday = monday;
  for (let day = 0; day < 5; day += 1) {
    saturday = dayAfter(saturday);
  }
  return [saturday, dayAfter(saturday)];
}

/**
 * Whether classes, kolokwia or exams take place at the weekend of the week
 * that starts on `monday`; cancelled classes and days off do not count.
 */
export function weekendHasItems(
  series: readonly EventSeries[],
  assessments: readonly ScheduledAssessment[],
  semester: Pick<Semester, 'daysOff'>,
  monday: string,
): boolean {
  const weekend = weekendOf(monday);
  return (
    weekend.some((date) => classesOn(series, date, semester).length > 0) ||
    assessments.some((scheduled) => weekend.includes(scheduled.date))
  );
}

/** Saturday or Sunday. */
export function isWeekend(date: string): boolean {
  const day = fromIso(date).getUTCDay();
  return day === 0 || day === 6;
}

function fromIso(date: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC',
    ...options,
  }).format(fromIso(date));
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "Październik 2026", "5–9 października 2026" or
 * "Poniedziałek, 5 października 2026".
 */
export function calendarTitle(
  view: CalendarView,
  first: string,
  last: string,
): string {
  if (view === 'dayGridMonth') {
    return capitalized(format(first, { month: 'long', year: 'numeric' }));
  }
  if (view === 'timeGridDay') {
    return capitalized(
      format(first, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }

  const [firstYear, firstMonth] = first.split('-');
  const [lastYear, lastMonth] = last.split('-');
  if (firstYear !== lastYear) {
    const full = { day: 'numeric', month: 'long', year: 'numeric' } as const;
    return `${format(first, full)} – ${format(last, full)}`;
  }
  if (firstMonth !== lastMonth) {
    const dayMonth = { day: 'numeric', month: 'long' } as const;
    return `${format(first, dayMonth)} – ${format(last, dayMonth)} ${lastYear}`;
  }
  return `${format(first, { day: 'numeric' })}–${format(last, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
}
