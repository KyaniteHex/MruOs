import { DateTime } from 'luxon';
import { expandOccurrences } from './recurrence.js';
import type {
  Assessment,
  ClassAnchor,
  EntryRecord,
  Event,
  EventSeries,
  Semester,
} from './types.js';

const zone = 'Europe/Warsaw';

type DaysOff = Pick<Semester, 'daysOff'>;

/** A class held on a given day, after changes to that single occurrence. */
export type DatedClass = {
  seriesId: string;
  date: string;
  event: Event;
  start: DateTime;
  end: DateTime;
};

/** Classes held on `date`, earliest first. */
export function classesOn(
  series: readonly EventSeries[],
  date: string,
  semester: DaysOff,
): DatedClass[] {
  return series
    .flatMap(({ id, event }) =>
      expandOccurrences(
        event,
        { startDate: date, endDate: date },
        semester,
      ).map((occurrence) => ({
        seriesId: id,
        date,
        event: occurrence.event,
        start: occurrence.start,
        end: occurrence.end,
      })),
    )
    .sort((left, right) =>
      left.event.startTime.localeCompare(right.event.startTime),
    );
}

/** The anchor that pins an entry to this class. */
export function classAnchor(dated: DatedClass): ClassAnchor {
  return {
    type: 'class',
    classType: dated.event.classType,
    date: dated.date,
    startTime: dated.event.startTime,
  };
}

/**
 * The class an entry is pinned to. The start time tells apart classes of the
 * same subject and type on one day; if the time has changed since and only
 * one such class is left, the entry stays with it.
 */
export function findAnchoredClass(
  subject: string,
  anchor: ClassAnchor,
  classes: readonly DatedClass[],
): DatedClass | undefined {
  const candidates = classes.filter(
    (dated) =>
      dated.date === anchor.date &&
      dated.event.subject === subject &&
      dated.event.classType === anchor.classType,
  );

  return (
    candidates.find((dated) => dated.event.startTime === anchor.startTime) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

/** A kolokwium or an exam with its date, time and place worked out. */
export type ScheduledAssessment = {
  id: string;
  assessment: Assessment;
  date: string;
  start: DateTime;
  end: DateTime;
  building?: string;
  room?: string;
  /** The class it takes place in, if any. */
  seriesId?: string;
};

export type PlacedEntries = {
  /** Entries pinned to a class, keyed by `classKey`. */
  byClass: Map<string, EntryRecord[]>;
  /** Notes about a whole subject, keyed by subject. */
  subjectNotes: Map<string, EntryRecord[]>;
  /** Kolokwia and exams that take place, earliest first. */
  assessments: ScheduledAssessment[];
  /** Entries whose class or subject is no longer in the plan. */
  orphans: EntryRecord[];
};

export function classKey(seriesId: string, date: string): string {
  return `${seriesId}|${date}`;
}

function atTime(date: string, time: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone });
}

function append<Key>(
  map: Map<Key, EntryRecord[]>,
  key: Key,
  record: EntryRecord,
) {
  map.set(key, [...(map.get(key) ?? []), record]);
}

/**
 * Finds where each entry belongs in the plan. Entries are pinned to classes
 * by subject, type, date and time rather than by series, so they survive a
 * plan imported again; those that lost their class are orphans.
 */
export function placeEntries(
  records: readonly EntryRecord[],
  series: readonly EventSeries[],
  semester: DaysOff,
): PlacedEntries {
  const placed: PlacedEntries = {
    byClass: new Map(),
    subjectNotes: new Map(),
    assessments: [],
    orphans: [],
  };
  const subjects = new Set(series.map(({ event }) => event.subject));
  const classesByDate = new Map<string, DatedClass[]>();
  const classesFor = (date: string) => {
    const cached = classesByDate.get(date);
    if (cached) {
      return cached;
    }
    const classes = classesOn(series, date, semester);
    classesByDate.set(date, classes);
    return classes;
  };

  for (const record of records) {
    const { entry } = record;
    const { anchor } = entry;

    if (anchor.type === 'class') {
      const dated = findAnchoredClass(
        entry.subject,
        anchor,
        classesFor(anchor.date),
      );
      if (!dated) {
        placed.orphans.push(record);
        continue;
      }

      append(placed.byClass, classKey(dated.seriesId, dated.date), record);
      if (entry.kind !== 'note') {
        placed.assessments.push({
          id: record.id,
          assessment: entry,
          date: dated.date,
          start: dated.start,
          end: dated.end,
          building: dated.event.building,
          room: dated.event.room,
          seriesId: dated.seriesId,
        });
      }
    } else if (anchor.type === 'own') {
      if (entry.kind !== 'note') {
        placed.assessments.push({
          id: record.id,
          assessment: entry,
          date: anchor.date,
          start: atTime(anchor.date, anchor.startTime),
          end: atTime(anchor.date, anchor.endTime),
          building: anchor.building,
          room: anchor.room,
        });
      }
    } else if (subjects.has(entry.subject)) {
      append(placed.subjectNotes, entry.subject, record);
    } else {
      placed.orphans.push(record);
    }
  }

  placed.assessments.sort(
    (left, right) => left.start.toMillis() - right.start.toMillis(),
  );
  return placed;
}

export type UpcomingAssessment = ScheduledAssessment & {
  /** 0 for today, 1 for tomorrow. */
  daysLeft: number;
};

/** Kolokwia and exams from `today` up to `days` days ahead. */
export function upcomingAssessments(
  assessments: readonly ScheduledAssessment[],
  today: string,
  days = 14,
): UpcomingAssessment[] {
  const firstDay = DateTime.fromISO(today, { zone }).startOf('day');

  return assessments.flatMap((scheduled) => {
    const daysLeft = Math.round(
      DateTime.fromISO(scheduled.date, { zone })
        .startOf('day')
        .diff(firstDay, 'days').days,
    );

    return daysLeft >= 0 && daysLeft <= days
      ? [{ ...scheduled, daysLeft }]
      : [];
  });
}

/** `time` moved `minutes` later, but not past the end of the day. */
export function minutesLater(time: string, minutes: number): string {
  const start = DateTime.fromFormat(time, 'HH:mm', { zone });
  const end = start.plus({ minutes });

  return end.hasSame(start, 'day') ? end.toFormat('HH:mm') : '23:59';
}

/** Subjects in the plan, alphabetically. */
export function planSubjects(series: readonly EventSeries[]): string[] {
  return [...new Set(series.map(({ event }) => event.subject))].sort(
    (left, right) => left.localeCompare(right, 'pl'),
  );
}
