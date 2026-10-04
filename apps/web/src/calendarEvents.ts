import type { EventInput } from '@fullcalendar/core';
import { academicAnnotations, dayAfter } from '@mruos/shared';
import type { CalendarAnnotation } from '@mruos/shared';
import { readableTextColor } from '@mruos/shared/color';
import { expandOccurrences } from '@mruos/shared/recurrence';
import { semesterWeeksToDateRange } from '@mruos/shared/semester';
import type { ClassType, DateRange, Event, Semester } from '@mruos/shared';

export type CalendarEventDetails = {
  building: string;
  classType: ClassType;
  color: string;
  date: string;
  endTime: string;
  room: string;
  seriesId: string;
  startTime: string;
};

export type EventSeries = {
  id: string;
  event: Event;
};

export function toCalendarEvents(
  series: readonly EventSeries[],
  range: DateRange,
  semester?: Pick<Semester, 'daysOff'>,
): EventInput[] {
  return series.flatMap(({ id, event }) =>
    expandOccurrences(event, range, semester).map((occurrence) => ({
      id: `${id}-${occurrence.date}`,
      title: occurrence.event.subject,
      start: occurrence.start.toISO() ?? undefined,
      end: occurrence.end.toISO() ?? undefined,
      backgroundColor: occurrence.event.color,
      borderColor: occurrence.event.color,
      textColor: readableTextColor(occurrence.event.color),
      extendedProps: {
        building: occurrence.event.building,
        classType: occurrence.event.classType,
        color: occurrence.event.color,
        date: occurrence.date,
        endTime: occurrence.event.endTime,
        room: occurrence.event.room,
        seriesId: id,
        startTime: occurrence.event.startTime,
      } satisfies CalendarEventDetails,
    })),
  );
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
  const annotations: CalendarAnnotation[] = semester.academicYear
    ? academicAnnotations(semester.academicYear)
    : semester.daysOff.map((date) => ({
        kind: 'day-off',
        label: 'Dzień wolny',
        startDate: date,
        endDate: date,
      }));

  return annotations.map((annotation, index) => ({
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
  }));
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
