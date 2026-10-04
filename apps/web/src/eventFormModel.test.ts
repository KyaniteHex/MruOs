import { describe, expect, it } from 'vitest';
import { EventSchema } from '@mruos/shared';
import type { AcademicYear } from '@mruos/shared';
import {
  buildEventFromDraft,
  createEventFormDraft,
  defaultClassColors,
} from './eventFormModel';

const semester = { startDate: '2026-09-28' };

describe('event form model', () => {
  it('sets a default color based on class type', () => {
    const draft = createEventFormDraft(undefined, '2026-10-05', '2027-02-14');

    expect(draft.color).toBe(defaultClassColors.wyklad);
    expect(defaultClassColors.laboratorium).toBe('#39789a');
  });

  it('converts semester week inputs to inclusive dates', () => {
    const draft = {
      ...createEventFormDraft(undefined, '2026-10-05', '2027-02-14'),
      subject: 'Matematyka',
      building: 'Wydział Matematyki',
      room: '204',
      rangeMode: 'weeks' as const,
      firstWeek: '1',
      lastWeek: '6',
    };

    const result = buildEventFromDraft(
      draft,
      undefined,
      'series',
      '2026-10-05',
      semester,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.recurrence.startDate).toBe('2026-09-28');
      expect(result.event.recurrence.endDate).toBe('2026-11-08');
    }
  });

  it('counts weeks by the teaching periods of the academic calendar', () => {
    const academicYear: AcademicYear = {
      startYear: 2026,
      semesters: [
        {
          term: 'winter',
          startDate: '2026-10-01',
          endDate: '2027-02-21',
          periods: [
            {
              label: 'Zajęcia dydaktyczne',
              kind: 'teaching',
              startDate: '2026-10-02',
              endDate: '2026-12-20',
            },
            {
              label: 'Zajęcia dydaktyczne',
              kind: 'teaching',
              startDate: '2027-01-07',
              endDate: '2027-02-04',
            },
          ],
        },
      ],
      daysOff: [],
    };
    const draft = {
      ...createEventFormDraft(undefined, '2026-10-05', '2027-02-14'),
      subject: 'Etyka zawodu',
      building: 'Jagiellońska 13',
      room: '-1.5',
      byDay: ['TU' as const],
      rangeMode: 'weeks' as const,
      firstWeek: '11',
      lastWeek: '15',
    };
    const calendarSemester = { startDate: '2026-10-01', academicYear };

    const result = buildEventFromDraft(
      draft,
      undefined,
      'series',
      '2026-10-05',
      calendarSemester,
    );

    expect(result.success && result.event.recurrence).toMatchObject({
      startDate: '2026-12-15',
      endDate: '2027-02-02',
    });
    expect(
      buildEventFromDraft(
        { ...draft, lastWeek: '16' },
        undefined,
        'series',
        '2026-10-05',
        calendarSemester,
      ),
    ).toEqual({
      success: false,
      errors: [
        'Podaj tygodnie mieszczące się w okresach zajęć semestru z harmonogramu.',
      ],
    });
  });

  it('keeps recurrence intact and creates an override for one occurrence', () => {
    const initialEvent = EventSchema.parse({
      kind: 'class',
      subject: 'Matematyka',
      classType: 'wyklad',
      color: '#25745b',
      building: 'Wydział Matematyki',
      room: '204',
      startTime: '08:00',
      endTime: '10:00',
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2026-11-02',
      },
    });
    const draft = {
      ...createEventFormDraft(initialEvent, '2026-10-05', '2026-11-02'),
      room: '112',
    };

    const result = buildEventFromDraft(
      draft,
      initialEvent,
      'occurrence',
      '2026-10-12',
      semester,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.recurrence).toEqual(initialEvent.recurrence);
      expect(result.event.exceptions).toContainEqual({
        date: '2026-10-12',
        override: expect.objectContaining({ room: '112' }),
      });
      expect(result.range).toEqual({
        startDate: '2026-10-12',
        endDate: '2026-10-12',
      });
    }
  });

  it('rejects an end time before the start time', () => {
    const draft = {
      ...createEventFormDraft(undefined, '2026-10-05', '2027-02-14'),
      subject: 'Matematyka',
      building: 'Wydział Matematyki',
      room: '204',
      startTime: '11:00',
      endTime: '10:00',
    };

    expect(
      buildEventFromDraft(draft, undefined, 'series', '2026-10-05', semester),
    ).toMatchObject({
      success: false,
      errors: ['Koniec musi przypadać po początku.'],
    });
  });

  it('rejects an end date before the start date', () => {
    const draft = {
      ...createEventFormDraft(undefined, '2026-10-05', '2027-02-14'),
      subject: 'Matematyka',
      building: 'Wydział Matematyki',
      room: '204',
      startDate: '2026-11-02',
      endDate: '2026-10-05',
    };

    expect(
      buildEventFromDraft(draft, undefined, 'series', '2026-10-05', semester),
    ).toMatchObject({
      success: false,
      errors: ['Koniec musi przypadać po początku.'],
    });
  });
});
