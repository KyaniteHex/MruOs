import { DateTime } from 'luxon';
import type {
  DateRange,
  Event,
  Occurrence,
  SemesterDays,
  Weekday,
} from './types.js';

const weekdayNumbers: Record<Weekday, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

function parseDate(value: string, zone: string): DateTime {
  const date = DateTime.fromISO(value, { zone }).startOf('day');

  if (!date.isValid) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }

  return date;
}

function timeParts(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

export function expandOccurrences(
  event: Event,
  range: DateRange,
  semester?: SemesterDays,
): Occurrence[] {
  const { recurrence } = event;
  const rangeStart = parseDate(range.startDate, event.timezone);
  const rangeEnd = parseDate(range.endDate, event.timezone);
  const recurrenceStart = parseDate(recurrence.startDate, event.timezone);
  const recurrenceEnd = parseDate(recurrence.endDate, event.timezone);

  if (rangeEnd < rangeStart) {
    throw new RangeError('Range endDate must not be before startDate');
  }

  const start = rangeStart > recurrenceStart ? rangeStart : recurrenceStart;
  const end = rangeEnd < recurrenceEnd ? rangeEnd : recurrenceEnd;

  if (end < start) {
    return [];
  }

  const exceptionByDate = new Map(
    event.exceptions.map((exception) => [exception.date, exception]),
  );
  const daysOff = new Set(semester?.daysOff ?? []);
  // Days with classes as on another weekday, e.g. a Thursday as a Monday.
  const dayPlans = new Map(
    (semester?.academicYear?.dayPlans ?? []).map((plan) => [
      plan.date,
      weekdayNumbers[plan.weekday],
    ]),
  );
  const weekdays = recurrence.byDay
    .map((weekday) => weekdayNumbers[weekday])
    .sort((left, right) => left - right);
  const recurrenceWeekStart = recurrenceStart.startOf('week');
  const finalWeekStart = end.startOf('week');
  const occurrences: Occurrence[] = [];

  for (
    let weekStart = recurrenceWeekStart;
    weekStart <= finalWeekStart;
    weekStart = weekStart.plus({ weeks: recurrence.interval })
  ) {
    const classDays: DateTime[] = [];
    for (const weekday of weekdays) {
      const day = weekStart.plus({ days: weekday - 1 }).startOf('day');
      const planned = dayPlans.get(day.toISODate() ?? '');
      // A day following another weekday's plan has none of its own classes.
      if (planned === undefined || planned === weekday) {
        classDays.push(day);
      }
    }
    for (const [planDate, plannedWeekday] of dayPlans) {
      const day = parseDate(planDate, event.timezone);
      if (
        weekdays.includes(plannedWeekday) &&
        day.weekday !== plannedWeekday &&
        +day.startOf('week') === +weekStart
      ) {
        classDays.push(day);
      }
    }
    classDays.sort((left, right) => +left - +right);

    for (const occurrenceDate of classDays) {
      const date = occurrenceDate.toISODate();

      if (
        date === null ||
        occurrenceDate < start ||
        occurrenceDate > end ||
        daysOff.has(date)
      ) {
        continue;
      }

      const exception = exceptionByDate.get(date);

      if (
        exception &&
        'status' in exception &&
        exception.status === 'cancelled'
      ) {
        continue;
      }

      const occurrenceEvent: Event = {
        ...event,
        ...(exception && 'override' in exception ? exception.override : {}),
      };
      const startTime = timeParts(occurrenceEvent.startTime);
      const endTime = timeParts(occurrenceEvent.endTime);

      occurrences.push({
        date,
        start: occurrenceDate.set({ ...startTime, second: 0, millisecond: 0 }),
        end: occurrenceDate.set({ ...endTime, second: 0, millisecond: 0 }),
        event: occurrenceEvent,
      });
    }
  }

  return occurrences;
}
