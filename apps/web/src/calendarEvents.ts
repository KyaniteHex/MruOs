import type { EventInput } from '@fullcalendar/core';
import {
  classBlockColors,
  classKey,
  dayAfter,
  semesterAnnotations,
} from '@mruos/shared';
import type {
  AssessmentKind,
  CalendarAnnotation,
  ClassBlockColors,
  EntryRecord,
  PlacedEntries,
  ScheduledAssessment,
} from '@mruos/shared';
import { expandOccurrences } from '@mruos/shared/recurrence';
import { semesterWeeksToDateRange } from '@mruos/shared/semester';
import type { ClassType, DateRange, Event, Semester } from '@mruos/shared';

/** Kolokwia, exams and notes pinned to a class. */
export type ClassMarks = {
  test: boolean;
  exam: boolean;
  note: boolean;
};

export type CalendarEventDetails = {
  building: string;
  classType: ClassType;
  color: string;
  /** The block's tint and stripe in both themes. */
  colors: ClassBlockColors;
  date: string;
  endTime: string;
  marks: ClassMarks;
  room: string;
  seriesId: string;
  startTime: string;
};

export function classMarks(
  records: readonly EntryRecord[] | undefined,
): ClassMarks {
  const kinds = new Set(records?.map(({ entry }) => entry.kind));
  return {
    test: kinds.has('test'),
    exam: kinds.has('exam'),
    note: kinds.has('note'),
  };
}

export type EventSeries = {
  id: string;
  event: Event;
};

export function toCalendarEvents(
  series: readonly EventSeries[],
  range: DateRange,
  semester?: Pick<Semester, 'daysOff'>,
  placed?: Pick<PlacedEntries, 'byClass'>,
): EventInput[] {
  const colorsByValue = new Map<string, ClassBlockColors>();
  const colorsOf = (color: string) => {
    const known = colorsByValue.get(color);
    if (known) {
      return known;
    }
    const colors = classBlockColors(color);
    colorsByValue.set(color, colors);
    return colors;
  };

  return series.flatMap(({ id, event }) =>
    expandOccurrences(event, range, semester).map((occurrence) => {
      const marks = classMarks(
        placed?.byClass.get(classKey(id, occurrence.date)),
      );

      return {
        id: `${id}-${occurrence.date}`,
        title: occurrence.event.subject,
        start: occurrence.start.toISO() ?? undefined,
        end: occurrence.end.toISO() ?? undefined,
        // An exam outranks a kolokwium in the outline.
        classNames: [
          'class-event',
          ...(marks.exam ? ['has-exam'] : marks.test ? ['has-test'] : []),
        ],
        extendedProps: {
          building: occurrence.event.building,
          classType: occurrence.event.classType,
          color: occurrence.event.color,
          colors: colorsOf(occurrence.event.color),
          date: occurrence.date,
          endTime: occurrence.event.endTime,
          marks,
          room: occurrence.event.room,
          seriesId: id,
          startTime: occurrence.event.startTime,
        } satisfies CalendarEventDetails,
      };
    }),
  );
}

export type AssessmentEventDetails = {
  assessmentId: string;
  kind: AssessmentKind;
  room?: string;
};

/** Kolokwia and exams at their own time, as blocks of their own. */
export function toAssessmentEvents(
  assessments: readonly ScheduledAssessment[],
  range: DateRange,
): EventInput[] {
  return assessments
    .filter(
      (scheduled) =>
        !scheduled.seriesId &&
        scheduled.date >= range.startDate &&
        scheduled.date <= range.endDate,
    )
    .map((scheduled) => ({
      id: `entry-${scheduled.id}`,
      title: `${scheduled.assessment.title}: ${scheduled.assessment.subject}`,
      start: scheduled.start.toISO() ?? undefined,
      end: scheduled.end.toISO() ?? undefined,
      display: 'block',
      classNames: [
        'calendar-assessment',
        `calendar-assessment-${scheduled.assessment.kind}`,
      ],
      extendedProps: {
        assessmentId: scheduled.id,
        kind: scheduled.assessment.kind,
        room: scheduled.room,
      } satisfies AssessmentEventDetails,
    }));
}

export type AnnotationDetails = {
  annotation: true;
  kind: CalendarAnnotation['kind'];
  label: string;
  startDate: string;
  endDate: string;
};

/**
 * Days off as blocks and breaks, exams and events as bars. Without an
 * academic calendar the semester's days off get a generic name.
 */
export function toAnnotationEvents(semester: Semester): EventInput[] {
  const annotations = semesterAnnotations(semester);
  // Days off also shade their whole day, e.g. a column of the week view.
  const shades: EventInput[] = annotations
    .filter((annotation) => annotation.kind === 'day-off')
    .map((annotation, index) => ({
      id: `day-off-shade-${index}`,
      start: annotation.startDate,
      end: dayAfter(annotation.endDate),
      allDay: true,
      display: 'background',
      classNames: ['day-off-shade'],
    }));

  return [
    ...shades,
    ...annotations.map((annotation, index) => ({
      id: `annotation-${index}`,
      title:
        annotation.kind === 'day-off' && annotation.label !== 'Dzień wolny'
          ? `Dzień wolny: ${annotation.label}`
          : annotation.label,
      start: annotation.startDate,
      // FullCalendar ends all-day events on the following day, exclusively.
      end: dayAfter(annotation.endDate),
      allDay: true,
      display: 'block',
      classNames: [
        'calendar-annotation',
        `calendar-annotation-${annotation.kind}`,
      ],
      extendedProps: {
        annotation: true,
        kind: annotation.kind,
        label: annotation.label,
        startDate: annotation.startDate,
        endDate: annotation.endDate,
      } satisfies AnnotationDetails,
    })),
  ];
}

export const demoSemester: Semester = {
  startDate: '2026-09-28',
  daysOff: ['2026-11-11'],
};

export const demoRange = semesterWeeksToDateRange(demoSemester, 1, 20);

const demoEvents: Event[] = [
  {
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
      ...demoRange,
    },
    exceptions: [],
  },
  {
    kind: 'class',
    subject: 'Analiza matematyczna',
    classType: 'cwiczenia',
    color: '#bf6548',
    building: 'Wydział Matematyki',
    room: '112',
    startTime: '09:00',
    endTime: '11:00',
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: 1,
      byDay: ['MO'],
      ...demoRange,
    },
    exceptions: [],
  },
  {
    kind: 'class',
    subject: 'Programowanie',
    classType: 'laboratorium',
    color: '#39789a',
    building: 'Centrum Informatyczne',
    room: 'Lab 3',
    startTime: '11:00',
    endTime: '13:00',
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: 1,
      byDay: ['WE'],
      ...demoRange,
    },
    exceptions: [],
  },
  {
    kind: 'class',
    subject: 'Fizyka',
    classType: 'wyklad',
    color: '#96703e',
    building: 'Budynek A',
    room: 'Audytorium 1',
    startTime: '12:00',
    endTime: '14:00',
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: 1,
      byDay: ['TH'],
      ...demoRange,
    },
    exceptions: [],
  },
  {
    kind: 'class',
    subject: 'Język angielski',
    classType: 'seminarium',
    color: '#687b38',
    building: 'Centrum Językowe',
    room: '18',
    startTime: '09:00',
    endTime: '10:30',
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['FR'],
      ...demoRange,
    },
    exceptions: [],
  },
];

export const demoEventSeries: EventSeries[] = demoEvents.map(
  (event, position) => ({ id: `demo-${position + 1}`, event }),
);

export const demoCalendarEvents = toCalendarEvents(
  demoEventSeries,
  demoRange,
  demoSemester,
);
