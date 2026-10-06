import {
  CalendarSnapshotSchema,
  EntrySchema,
  EventSchema,
} from '@mruos/shared';
import type { CalendarSnapshot, EntryRecord } from '@mruos/shared';
import { EntryModel } from '../models/entry.js';
import { EventModel } from '../models/event.js';
import { SemesterModel } from '../models/semester.js';
import { semesterFromRecord } from './semesterData.js';

export async function loadEntries(userId: string): Promise<EntryRecord[]> {
  const records = await EntryModel.find({ userId })
    .sort({ createdAt: 1 })
    .lean();

  return records.map((record) => ({
    id: record.clientId,
    entry: EntrySchema.parse(record.entry),
  }));
}

/** The user's whole plan: classes, semester and entries. */
export async function loadCalendar(userId: string): Promise<CalendarSnapshot> {
  const [records, entries, semesterRecord] = await Promise.all([
    EventModel.find({ userId }).sort({ createdAt: 1 }).lean(),
    loadEntries(userId),
    SemesterModel.findOne({ userId }).lean(),
  ]);

  return CalendarSnapshotSchema.parse({
    events: records.map((record) => ({
      id: record.clientId,
      event: EventSchema.parse(record.event),
    })),
    semester: semesterFromRecord(semesterRecord),
    entries,
  });
}
