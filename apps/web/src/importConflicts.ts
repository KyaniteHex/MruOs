import { expandOccurrences } from '@mruos/shared/recurrence';
import type { Event, Semester } from '@mruos/shared';

// Overlaps between classes of a timetable import and the classes they would
// sit next to, compared on real dates rather than weekdays alone.

export type ScheduleEntry = {
  id: string;
  event: Event;
  /** True for series already saved in the student's plan. */
  existing: boolean;
};

type Slot = {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  existing: boolean;
};

export type SlotIndex = Map<string, Slot[]>;

export type EntryConflict = {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  existing: boolean;
  /** Dates on which both classes take place at overlapping times. */
  dates: string[];
};

type SemesterDaysOff = Pick<Semester, 'daysOff'>;

export type OccurrenceSlot = {
  date: string;
  subject: string;
  startTime: string;
  endTime: string;
};

/** Dated time slots of a series, with one-day overrides applied. */
export function eventSlots(
  event: Event,
  semester: SemesterDaysOff,
): OccurrenceSlot[] {
  return expandOccurrences(
    event,
    {
      startDate: event.recurrence.startDate,
      endDate: event.recurrence.endDate,
    },
    semester,
  ).map((occurrence) => ({
    date: occurrence.date,
    subject: occurrence.event.subject,
    startTime: occurrence.event.startTime,
    endTime: occurrence.event.endTime,
  }));
}

export function buildSlotIndex(
  entries: readonly ScheduleEntry[],
  semester: SemesterDaysOff,
): SlotIndex {
  const index: SlotIndex = new Map();

  for (const entry of entries) {
    for (const slot of eventSlots(entry.event, semester)) {
      const slots = index.get(slot.date) ?? [];
      slots.push({ ...slot, id: entry.id, existing: entry.existing });
      index.set(slot.date, slots);
    }
  }

  return index;
}

/**
 * Classes in `index` that overlap `slots`, one item per other class.
 * Entries listed in `ignoredIds` are skipped, e.g. the subject's own classes.
 */
export function findSlotConflicts(
  id: string,
  slots: readonly OccurrenceSlot[],
  index: SlotIndex,
  ignoredIds: ReadonlySet<string> = new Set(),
): EntryConflict[] {
  const conflicts = new Map<string, EntryConflict>();

  for (const occurrence of slots) {
    for (const slot of index.get(occurrence.date) ?? []) {
      const overlaps =
        slot.id !== id &&
        !ignoredIds.has(slot.id) &&
        occurrence.startTime < slot.endTime &&
        occurrence.endTime > slot.startTime;
      if (!overlaps) {
        continue;
      }
      const conflict = conflicts.get(slot.id) ?? {
        id: slot.id,
        subject: slot.subject,
        startTime: slot.startTime,
        endTime: slot.endTime,
        existing: slot.existing,
        dates: [],
      };
      conflict.dates.push(occurrence.date);
      conflicts.set(slot.id, conflict);
    }
  }

  return [...conflicts.values()];
}

export function findEntryConflicts(
  id: string,
  event: Event,
  index: SlotIndex,
  semester: SemesterDaysOff,
): EntryConflict[] {
  return findSlotConflicts(id, eventSlots(event, semester), index);
}
