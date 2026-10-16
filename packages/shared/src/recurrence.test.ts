import { describe, expect, it } from 'vitest';
import { EventSchema } from './schemas.js';
import { expandOccurrences } from './recurrence.js';
import { semesterWeeksToDateRange } from './semester.js';

function makeEvent(
  startDate: string,
  endDate: string,
  interval = 1,
  exceptions: unknown[] = [],
) {
  return EventSchema.parse({
    kind: 'class',
    subject: 'Matematyka',
    classType: 'cwiczenia',
    color: '#3b82f6',
    building: 'Wydział Mechaniczny',
    room: '204',
    startTime: '08:00',
    endTime: '10:00',
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval,
      byDay: ['MO'],
      startDate,
      endDate,
    },
    exceptions,
  });
}

describe('expandOccurrences', () => {
  it('expands weekly events and includes the final date', () => {
    const event = makeEvent('2026-10-05', '2026-10-19');

    const occurrences = expandOccurrences(event, {
      startDate: '2026-10-05',
      endDate: '2026-10-19',
    });

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
  });

  it('expands every other week from the week containing recurrence start', () => {
    const event = makeEvent('2026-10-05', '2026-10-26', 2);

    const occurrences = expandOccurrences(event, {
      startDate: '2026-10-05',
      endDate: '2026-10-26',
    });

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      '2026-10-05',
      '2026-10-19',
    ]);
  });

  it('applies cancellations, overrides, and semester days off', () => {
    const event = makeEvent('2026-10-05', '2026-10-26', 1, [
      { date: '2026-10-12', status: 'cancelled' },
      { date: '2026-10-19', override: { room: '112' } },
    ]);

    const occurrences = expandOccurrences(
      event,
      { startDate: '2026-10-05', endDate: '2026-10-26' },
      { daysOff: ['2026-10-26'] },
    );

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      '2026-10-05',
      '2026-10-19',
    ]);
    expect(occurrences[1]?.event.room).toBe('112');
  });

  it('ends one class series after week 6 and starts the next in week 7', () => {
    const semester = { startDate: '2026-09-28' };
    const semesterRange = semesterWeeksToDateRange(semester, 1, 12);
    const firstSeriesRange = semesterWeeksToDateRange(semester, 1, 6);
    const secondSeriesRange = semesterWeeksToDateRange(semester, 7, 12);
    const firstSeries = {
      ...makeEvent(firstSeriesRange.startDate, firstSeriesRange.endDate),
      subject: 'Zajęcia X',
    };
    const secondSeries = {
      ...makeEvent(secondSeriesRange.startDate, secondSeriesRange.endDate),
      subject: 'Zajęcia Y',
    };

    const firstOccurrences = expandOccurrences(firstSeries, semesterRange);
    const secondOccurrences = expandOccurrences(secondSeries, semesterRange);

    expect(firstOccurrences.at(-1)?.date).toBe('2026-11-02');
    expect(secondOccurrences[0]?.date).toBe('2026-11-09');
  });

  it.each([
    ['2026-10-19', '2026-11-02'],
    ['2026-03-23', '2026-03-30'],
  ])('keeps local class times stable across DST for %s to %s', (start, end) => {
    const event = makeEvent(start, end);
    const occurrences = expandOccurrences(event, {
      startDate: start,
      endDate: end,
    });

    expect(occurrences.length).toBeGreaterThan(1);
    expect(occurrences.every((occurrence) => occurrence.start.hour === 8)).toBe(
      true,
    );
    expect(
      occurrences.every(
        (occurrence) => occurrence.start.zoneName === 'Europe/Warsaw',
      ),
    ).toBe(true);
  });

  describe('with days that follow another weekday’s plan', () => {
    // 28.01.2027 is a Thursday with Monday classes (UG 2026/2027).
    const semester = {
      daysOff: [],
      academicYear: {
        startYear: 2026,
        semesters: [],
        daysOff: [],
        dayPlans: [{ date: '2027-01-28', weekday: 'MO' as const }],
      },
    };
    const lastWeek = { startDate: '2027-01-25', endDate: '2027-01-31' };

    it('holds Monday classes on that day and none of its own', () => {
      const monday = makeEvent('2027-01-04', '2027-01-31');
      const thursday = EventSchema.parse({
        ...monday,
        recurrence: { ...monday.recurrence, byDay: ['TH'] },
      });

      expect(
        expandOccurrences(monday, lastWeek, semester).map(
          (occurrence) => occurrence.date,
        ),
      ).toEqual(['2027-01-25', '2027-01-28']);
      expect(
        expandOccurrences(thursday, lastWeek, semester).map(
          (occurrence) => occurrence.date,
        ),
      ).toEqual([]);
    });

    it('keeps the series rhythm, its end, cancellations and days off', () => {
      // Every other week from 2027-01-11: the week of 2027-01-25 is in it.
      expect(
        expandOccurrences(
          makeEvent('2027-01-11', '2027-01-31', 2),
          lastWeek,
          semester,
        ).map((occurrence) => occurrence.date),
      ).toEqual(['2027-01-25', '2027-01-28']);
      expect(
        expandOccurrences(
          makeEvent('2027-01-04', '2027-01-31', 2),
          lastWeek,
          semester,
        ),
      ).toEqual([]);
      expect(
        expandOccurrences(
          makeEvent('2027-01-04', '2027-01-25'),
          lastWeek,
          semester,
        ).map((occurrence) => occurrence.date),
      ).toEqual(['2027-01-25']);
      expect(
        expandOccurrences(
          makeEvent('2027-01-04', '2027-01-31', 1, [
            { date: '2027-01-28', status: 'cancelled' },
          ]),
          lastWeek,
          semester,
        ).map((occurrence) => occurrence.date),
      ).toEqual(['2027-01-25']);
      expect(
        expandOccurrences(makeEvent('2027-01-04', '2027-01-31'), lastWeek, {
          ...semester,
          daysOff: ['2027-01-28'],
        }).map((occurrence) => occurrence.date),
      ).toEqual(['2027-01-25']);
    });

    it('keeps the class times on that day', () => {
      const [, swapped] = expandOccurrences(
        makeEvent('2027-01-04', '2027-01-31'),
        lastWeek,
        semester,
      );

      expect(swapped?.start.toISO()).toBe('2027-01-28T08:00:00.000+01:00');
      expect(swapped?.end.toISO()).toBe('2027-01-28T10:00:00.000+01:00');
    });
  });
});
