import { describe, expect, it } from 'vitest';
import {
  CalendarSnapshotSchema,
  EntryRecordSchema,
  EntrySchema,
} from './schemas.js';

const duringClass = {
  type: 'class',
  classType: 'cwiczenia',
  date: '2026-11-16',
  startTime: '08:00',
};

const kolokwium = {
  kind: 'test',
  subject: 'Matematyka',
  title: 'Kolokwium',
  reminders: ['P1D'],
  anchor: duringClass,
};

const exam = {
  kind: 'exam',
  subject: 'Matematyka',
  title: 'Egzamin',
  details: 'Całki i szeregi',
  reminders: ['P7D', 'P1D'],
  anchor: {
    type: 'own',
    date: '2027-02-08',
    startTime: '09:00',
    endTime: '11:00',
    building: 'Wydział Matematyki',
    room: 'Aula',
  },
};

describe('EntrySchema', () => {
  it('accepts kolokwia and exams during a class or at their own time', () => {
    expect(EntrySchema.safeParse(kolokwium).success).toBe(true);
    expect(EntrySchema.safeParse(exam).success).toBe(true);
    expect(
      EntrySchema.safeParse({ ...exam, anchor: duringClass }).success,
    ).toBe(true);
    expect(
      EntrySchema.safeParse({
        ...kolokwium,
        anchor: { ...exam.anchor, building: undefined, room: undefined },
      }).success,
    ).toBe(true);
  });

  it('accepts notes about a class or a whole subject', () => {
    const note = {
      kind: 'note',
      subject: 'Matematyka',
      text: 'Przynieść kalkulator',
      anchor: duringClass,
    };

    expect(EntrySchema.safeParse(note).success).toBe(true);
    expect(
      EntrySchema.safeParse({ ...note, anchor: { type: 'subject' } }).success,
    ).toBe(true);
  });

  it('rejects entries that do not fit their kind', () => {
    // Only notes may be about a whole subject.
    expect(
      EntrySchema.safeParse({ ...exam, anchor: { type: 'subject' } }).success,
    ).toBe(false);
    // Notes have no own time.
    expect(
      EntrySchema.safeParse({
        kind: 'note',
        subject: 'Matematyka',
        text: 'Notatka',
        anchor: exam.anchor,
      }).success,
    ).toBe(false);
    expect(
      EntrySchema.safeParse({
        kind: 'note',
        subject: 'Matematyka',
        text: '   ',
        anchor: duringClass,
      }).success,
    ).toBe(false);
  });

  it('rejects reversed times, unknown or repeated reminders and long texts', () => {
    expect(
      EntrySchema.safeParse({
        ...exam,
        anchor: { ...exam.anchor, endTime: '08:00' },
      }).success,
    ).toBe(false);
    expect(
      EntrySchema.safeParse({ ...exam, reminders: ['PT15M'] }).success,
    ).toBe(false);
    expect(
      EntrySchema.safeParse({ ...exam, reminders: ['P1D', 'P1D'] }).success,
    ).toBe(false);
    expect(
      EntrySchema.safeParse({
        kind: 'note',
        subject: 'Matematyka',
        text: 'x'.repeat(2001),
        anchor: duringClass,
      }).success,
    ).toBe(false);
  });
});

describe('CalendarSnapshotSchema', () => {
  it('reads plans saved before entries existed as having none', () => {
    const snapshot = CalendarSnapshotSchema.parse({
      events: [],
      semester: { startDate: '2026-10-01', daysOff: [] },
    });

    expect(snapshot.entries).toEqual([]);
  });

  it('keeps entries with their ids', () => {
    const record = EntryRecordSchema.parse({ id: 'entry-1', entry: exam });
    const snapshot = CalendarSnapshotSchema.parse({
      events: [],
      semester: { startDate: '2026-10-01', daysOff: [] },
      entries: [record],
    });

    expect(snapshot.entries).toEqual([record]);
  });
});
