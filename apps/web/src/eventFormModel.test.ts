import { describe, expect, it } from 'vitest';
import { EventSchema } from '@mruos/shared';
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
