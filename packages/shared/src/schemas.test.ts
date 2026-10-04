import { describe, expect, it } from 'vitest';
import { AcademicYearSchema, EventSchema, SemesterSchema } from './schemas.js';

const validEvent = {
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
    interval: 1,
    byDay: ['MO'],
    startDate: '2026-10-05',
    endDate: '2026-11-13',
  },
  exceptions: [],
};

describe('EventSchema', () => {
  it('accepts a valid weekly event and its exceptions', () => {
    const result = EventSchema.safeParse({
      ...validEvent,
      exceptions: [
        { date: '2026-10-12', status: 'cancelled' },
        { date: '2026-10-19', override: { room: '112' } },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid times, reversed ranges, and unsupported intervals', () => {
    expect(
      EventSchema.safeParse({ ...validEvent, startTime: '25:00' }).success,
    ).toBe(false);
    expect(
      EventSchema.safeParse({ ...validEvent, endTime: '07:59' }).success,
    ).toBe(false);
    expect(
      EventSchema.safeParse({
        ...validEvent,
        recurrence: { ...validEvent.recurrence, interval: 3 },
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate exception dates', () => {
    expect(
      EventSchema.safeParse({
        ...validEvent,
        exceptions: [
          { date: '2026-10-12', status: 'cancelled' },
          { date: '2026-10-12', override: { room: '112' } },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects mixed exception variants and invalid partial time overrides', () => {
    expect(
      EventSchema.safeParse({
        ...validEvent,
        exceptions: [
          {
            date: '2026-10-12',
            status: 'cancelled',
            override: { room: '112' },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      EventSchema.safeParse({
        ...validEvent,
        exceptions: [{ date: '2026-10-12', override: { startTime: '10:30' } }],
      }).success,
    ).toBe(false);
  });
});

describe('SemesterSchema', () => {
  it('accepts a start date and unique days off', () => {
    expect(
      SemesterSchema.safeParse({
        startDate: '2026-09-28',
        daysOff: ['2026-11-01'],
      }).success,
    ).toBe(true);
  });
});

describe('AcademicYearSchema', () => {
  const teaching = (startDate: string, endDate: string) => ({
    label: 'Zajęcia dydaktyczne',
    kind: 'teaching' as const,
    startDate,
    endDate,
  });
  const year = (periods: ReturnType<typeof teaching>[]) => ({
    startYear: 2026,
    semesters: [
      {
        term: 'winter' as const,
        startDate: '2026-10-01',
        endDate: '2027-02-21',
        periods,
      },
    ],
    daysOff: [{ date: '2026-11-11', label: 'Narodowe Święto Niepodległości' }],
  });

  it('accepts a calendar with separate teaching periods', () => {
    const calendar = year([
      teaching('2026-10-02', '2026-12-20'),
      teaching('2027-01-07', '2027-02-04'),
    ]);

    expect(AcademicYearSchema.safeParse(calendar).success).toBe(true);
    expect(
      SemesterSchema.safeParse({
        startDate: '2026-10-01',
        daysOff: ['2026-11-11'],
        academicYear: calendar,
      }).success,
    ).toBe(true);
  });

  it('rejects overlapping teaching periods and reversed dates', () => {
    expect(
      AcademicYearSchema.safeParse(
        year([
          teaching('2026-10-02', '2026-12-20'),
          teaching('2026-12-20', '2027-02-04'),
        ]),
      ).success,
    ).toBe(false);
    expect(
      AcademicYearSchema.safeParse(year([teaching('2026-12-20', '2026-10-02')]))
        .success,
    ).toBe(false);
  });

  it('rejects duplicate days off and repeated terms', () => {
    const calendar = year([]);

    expect(
      AcademicYearSchema.safeParse({
        ...calendar,
        daysOff: [...calendar.daysOff, ...calendar.daysOff],
      }).success,
    ).toBe(false);
    expect(
      AcademicYearSchema.safeParse({
        ...calendar,
        semesters: [...calendar.semesters, ...calendar.semesters],
      }).success,
    ).toBe(false);
  });
});
