import { describe, expect, it } from 'vitest';
import {
  classesOn,
  classKey,
  findAnchoredClass,
  placeEntries,
  planSubjects,
  upcomingAssessments,
} from './entries.js';
import { EntryRecordSchema, EventSchema } from './schemas.js';
import type { ClassAnchor, EntryRecord, EventSeries } from './types.js';

function classSeries(
  id: string,
  subject: string,
  startTime: string,
  endTime: string,
  overrides: Record<string, unknown> = {},
): EventSeries {
  return {
    id,
    event: EventSchema.parse({
      kind: 'class',
      subject,
      classType: 'cwiczenia',
      color: '#3b82f6',
      building: 'Wydział Matematyki',
      room: '204',
      startTime,
      endTime,
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2027-01-25',
      },
      exceptions: [],
      ...overrides,
    }),
  };
}

const semester = { daysOff: ['2026-11-02'] };
const plan = [
  classSeries('physics', 'Fizyka', '12:00', '14:00'),
  classSeries('maths', 'Matematyka', '08:00', '10:00', {
    exceptions: [
      { date: '2026-10-26', override: { room: '112' } },
      { date: '2026-11-09', status: 'cancelled' },
    ],
  }),
];

function during(date: string, startTime = '08:00'): ClassAnchor {
  return { type: 'class', classType: 'cwiczenia', date, startTime };
}

function record(id: string, entry: unknown): EntryRecord {
  return EntryRecordSchema.parse({ id, entry });
}

function kolokwium(id: string, date: string, subject = 'Matematyka') {
  return record(id, {
    kind: 'test',
    subject,
    title: 'Kolokwium',
    reminders: ['P1D'],
    anchor: during(date),
  });
}

function exam(id: string, date: string) {
  return record(id, {
    kind: 'exam',
    subject: 'Matematyka',
    title: 'Egzamin',
    reminders: [],
    anchor: { type: 'own', date, startTime: '09:00', endTime: '11:00' },
  });
}

describe('classesOn', () => {
  it('lists the day’s classes earliest first, with single-day changes', () => {
    const classes = classesOn(plan, '2026-10-26', semester);

    expect(classes.map((dated) => [dated.seriesId, dated.event.room])).toEqual([
      ['maths', '112'],
      ['physics', '204'],
    ]);
  });

  it('skips days off and cancelled classes', () => {
    expect(classesOn(plan, '2026-11-02', semester)).toEqual([]);
    expect(
      classesOn(plan, '2026-11-09', semester).map((dated) => dated.seriesId),
    ).toEqual(['physics']);
  });
});

describe('findAnchoredClass', () => {
  const twoLabs = [
    classSeries('lab-early', 'Biofarmacja', '08:00', '10:00'),
    classSeries('lab-late', 'Biofarmacja', '10:00', '12:00'),
  ];
  const classes = classesOn(twoLabs, '2026-10-12', semester);

  it('tells apart classes of one subject by their start time', () => {
    expect(
      findAnchoredClass('Biofarmacja', during('2026-10-12', '10:00'), classes)
        ?.seriesId,
    ).toBe('lab-late');
  });

  it('keeps the entry when the only such class moved to another hour', () => {
    const moved = classesOn(
      [classSeries('lab', 'Biofarmacja', '09:00', '11:00')],
      '2026-10-12',
      semester,
    );

    expect(
      findAnchoredClass('Biofarmacja', during('2026-10-12'), moved)?.seriesId,
    ).toBe('lab');
  });

  it('gives up when several classes could be meant', () => {
    expect(
      findAnchoredClass('Biofarmacja', during('2026-10-12', '14:00'), classes),
    ).toBeUndefined();
  });
});

describe('placeEntries', () => {
  it('pins kolokwia and notes to their classes', () => {
    const test = kolokwium('test', '2026-10-26');
    const note = record('note', {
      kind: 'note',
      subject: 'Matematyka',
      text: 'Przynieść kalkulator',
      anchor: during('2026-10-26'),
    });

    const placed = placeEntries([test, note], plan, semester);

    expect(placed.byClass.get(classKey('maths', '2026-10-26'))).toEqual([
      test,
      note,
    ]);
    expect(placed.assessments).toHaveLength(1);
    expect(placed.assessments[0]).toMatchObject({
      id: 'test',
      date: '2026-10-26',
      room: '112',
      seriesId: 'maths',
    });
    expect(placed.assessments[0]?.start.toISO()).toBe(
      '2026-10-26T08:00:00.000+01:00',
    );
    expect(placed.orphans).toEqual([]);
  });

  it('schedules exams at their own time and lists them by date', () => {
    const later = exam('later', '2027-02-08');
    const sooner = kolokwium('sooner', '2026-10-19');

    const placed = placeEntries([later, sooner], plan, semester);

    expect(placed.assessments.map((scheduled) => scheduled.id)).toEqual([
      'sooner',
      'later',
    ]);
    expect(placed.assessments[1]?.start.toISO()).toBe(
      '2027-02-08T09:00:00.000+01:00',
    );
    expect(placed.byClass.size).toBe(1);
  });

  it('keeps subject notes while the subject is in the plan', () => {
    const note = record('note', {
      kind: 'note',
      subject: 'Fizyka',
      text: 'Egzamin ustny',
      anchor: { type: 'subject' },
    });

    expect(
      placeEntries([note], plan, semester).subjectNotes.get('Fizyka'),
    ).toEqual([note]);
    expect(placeEntries([note], [], semester).orphans).toEqual([note]);
  });

  it('lists entries whose class is cancelled, off or gone as orphans', () => {
    const onDayOff = kolokwium('day-off', '2026-11-02');
    const onCancelled = kolokwium('cancelled', '2026-11-09');
    const unknownSubject = kolokwium('chemistry', '2026-10-19', 'Chemia');

    const placed = placeEntries(
      [onDayOff, onCancelled, unknownSubject],
      plan,
      semester,
    );

    expect(placed.orphans).toEqual([onDayOff, onCancelled, unknownSubject]);
    expect(placed.assessments).toEqual([]);
  });

  it('finds the class again after the plan is imported anew', () => {
    const test = kolokwium('test', '2026-10-19');
    const reimported = plan.map((series) => ({
      ...series,
      id: `new-${series.id}`,
    }));

    const placed = placeEntries([test], reimported, semester);

    expect(placed.byClass.get(classKey('new-maths', '2026-10-19'))).toEqual([
      test,
    ]);
  });
});

describe('upcomingAssessments', () => {
  const { assessments } = placeEntries(
    [
      kolokwium('yesterday', '2026-10-19'),
      exam('today', '2026-10-20'),
      exam('tomorrow', '2026-10-21'),
      // After the clocks go back on 2026-10-25.
      exam('in-two-weeks', '2026-11-03'),
      exam('too-late', '2026-11-04'),
    ],
    plan,
    semester,
  );

  it('lists the next 14 days with the days left', () => {
    expect(
      upcomingAssessments(assessments, '2026-10-20').map((upcoming) => [
        upcoming.id,
        upcoming.daysLeft,
      ]),
    ).toEqual([
      ['today', 0],
      ['tomorrow', 1],
      ['in-two-weeks', 14],
    ]);
  });
});

describe('planSubjects', () => {
  it('lists each subject once in Polish alphabetical order', () => {
    expect(
      planSubjects([
        classSeries('a', 'Zoologia', '08:00', '09:00'),
        classSeries('b', 'Ćwiczenia terenowe', '08:00', '09:00'),
        classSeries('c', 'Chemia', '08:00', '09:00'),
        classSeries('d', 'Chemia', '10:00', '11:00'),
      ]),
    ).toEqual(['Chemia', 'Ćwiczenia terenowe', 'Zoologia']);
  });
});
