import type { EntryRecord, EventSeries } from './types.js';

export type HourRange = {
  /** First full hour shown, e.g. 8 for 08:00. */
  start: number;
  /** Hour the view ends at, up to 24. */
  end: number;
};

const emptyPlanHours: HourRange = { start: 8, end: 16 };
const shortestRange = 6;

function hours(time: string): number {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return hour + minute / 60;
}

/**
 * Whole hours that fit every class, single-day change and kolokwium or exam
 * at its own time, so the week view needs no empty mornings and evenings.
 */
export function planHours(
  series: readonly EventSeries[],
  entries: readonly EntryRecord[] = [],
): HourRange {
  const times = series.flatMap(({ event }) => [
    event.startTime,
    event.endTime,
    ...event.exceptions.flatMap((exception) =>
      'override' in exception
        ? [exception.override.startTime, exception.override.endTime].filter(
            (time): time is string => time !== undefined,
          )
        : [],
    ),
  ]);
  for (const { entry } of entries) {
    if (entry.anchor.type === 'own') {
      times.push(entry.anchor.startTime, entry.anchor.endTime);
    }
  }
  if (times.length === 0) {
    return emptyPlanHours;
  }

  const values = times.map(hours);
  const start = Math.floor(Math.min(...values));
  const end = Math.max(Math.ceil(Math.max(...values)), start + shortestRange);

  return { start, end: Math.min(end, 24) };
}
