import { EventSchema } from '@mruos/shared';
import { semesterWeeksToDateRange } from '@mruos/shared/semester';
import type {
  ClassType,
  DateRange,
  Event,
  ExceptionOverride,
  Semester,
  Weekday,
} from '@mruos/shared';

export type EventEditScope = 'occurrence' | 'series';
export type EventRangeMode = 'dates' | 'weeks';

export type EventFormDraft = {
  subject: string;
  classType: ClassType;
  color: string;
  building: string;
  room: string;
  startTime: string;
  endTime: string;
  byDay: Weekday[];
  interval: 1 | 2;
  rangeMode: EventRangeMode;
  startDate: string;
  endDate: string;
  firstWeek: string;
  lastWeek: string;
};

export type EventFormResult =
  | { success: true; event: Event; range: DateRange }
  | { success: false; errors: string[] };

export const classTypes: ClassType[] = [
  'wyklad',
  'cwiczenia',
  'laboratorium',
  'seminarium',
  'zajecia-praktyczne',
];

export const classTypeLabels: Record<ClassType, string> = {
  wyklad: 'Wykład',
  cwiczenia: 'Ćwiczenia',
  laboratorium: 'Laboratorium',
  seminarium: 'Seminarium',
  'zajecia-praktyczne': 'Zajęcia praktyczne',
};

export const defaultClassColors: Record<ClassType, string> = {
  wyklad: '#25745b',
  cwiczenia: '#bf6548',
  laboratorium: '#39789a',
  seminarium: '#96703e',
  'zajecia-praktyczne': '#7a5c99',
};

export function createEventFormDraft(
  event: Event | undefined,
  startDate: string,
  endDate: string,
): EventFormDraft {
  return {
    subject: event?.subject ?? '',
    classType: event?.classType ?? 'wyklad',
    color: event?.color ?? defaultClassColors.wyklad,
    building: event?.building ?? '',
    room: event?.room ?? '',
    startTime: event?.startTime ?? '08:00',
    endTime: event?.endTime ?? '10:00',
    byDay: event?.recurrence.byDay ?? ['MO'],
    interval: event?.recurrence.interval ?? 1,
    rangeMode: 'dates',
    startDate: event?.recurrence.startDate ?? startDate,
    endDate: event?.recurrence.endDate ?? endDate,
    firstWeek: '1',
    lastWeek: '20',
  };
}

function messageForIssue(path: PropertyKey[]): string {
  const field = path.join('.');

  switch (field) {
    case 'subject':
      return 'Podaj nazwę przedmiotu.';
    case 'building':
      return 'Podaj nazwę budynku.';
    case 'room':
      return 'Podaj salę.';
    case 'startTime':
      return 'Podaj godzinę rozpoczęcia w formacie GG:MM.';
    case 'endTime':
    case 'recurrence.endDate':
      return 'Koniec musi przypadać po początku.';
    case 'recurrence.startDate':
      return 'Podaj poprawną datę początkową.';
    case 'recurrence.byDay':
      return 'Wybierz co najmniej jeden dzień tygodnia.';
    default:
      return 'Sprawdź poprawność wprowadzonych danych.';
  }
}

export function buildEventFromDraft(
  draft: EventFormDraft,
  initialEvent: Event | undefined,
  scope: EventEditScope,
  occurrenceDate: string,
  semester: Pick<Semester, 'startDate'>,
): EventFormResult {
  let recurrenceRange: DateRange;

  if (scope === 'occurrence' && initialEvent) {
    recurrenceRange = initialEvent.recurrence;
  } else if (draft.rangeMode === 'weeks') {
    try {
      recurrenceRange = semesterWeeksToDateRange(
        semester,
        Number(draft.firstWeek),
        Number(draft.lastWeek),
      );
    } catch {
      return {
        success: false,
        errors: ['Podaj poprawny zakres tygodni semestru.'],
      };
    }
  } else {
    recurrenceRange = {
      startDate: draft.startDate,
      endDate: draft.endDate,
    };
  }

  const override: ExceptionOverride = {
    subject: draft.subject,
    classType: draft.classType,
    color: draft.color,
    building: draft.building,
    room: draft.room,
    startTime: draft.startTime,
    endTime: draft.endTime,
  };
  const exceptions =
    scope === 'occurrence' && initialEvent
      ? [
          ...initialEvent.exceptions.filter(
            (exception) => exception.date !== occurrenceDate,
          ),
          { date: occurrenceDate, override },
        ]
      : (initialEvent?.exceptions ?? []);
  const result = EventSchema.safeParse({
    kind: 'class',
    subject: draft.subject,
    classType: draft.classType,
    color: draft.color,
    building: draft.building,
    room: draft.room,
    startTime: draft.startTime,
    endTime: draft.endTime,
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: draft.interval,
      byDay: draft.byDay,
      ...recurrenceRange,
    },
    exceptions,
  });

  if (!result.success) {
    return {
      success: false,
      errors: [
        ...new Set(
          result.error.issues.map((issue) => messageForIssue(issue.path)),
        ),
      ],
    };
  }

  return {
    success: true,
    event: result.data,
    range:
      scope === 'occurrence'
        ? { startDate: occurrenceDate, endDate: occurrenceDate }
        : recurrenceRange,
  };
}
