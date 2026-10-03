import type { DateTime } from 'luxon';
import type {
  ClassTypeSchema,
  EventExceptionSchema,
  EventSchema,
  ExceptionOverrideSchema,
  RecurrenceSchema,
  SemesterSchema,
  WeekdaySchema,
} from './schemas.js';
import type { z } from 'zod';

export type Weekday = z.infer<typeof WeekdaySchema>;
export type ClassType = z.infer<typeof ClassTypeSchema>;
export type Recurrence = z.infer<typeof RecurrenceSchema>;
export type ExceptionOverride = z.infer<typeof ExceptionOverrideSchema>;
export type EventException = z.infer<typeof EventExceptionSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Semester = z.infer<typeof SemesterSchema>;

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type Occurrence = {
  date: string;
  start: DateTime;
  end: DateTime;
  event: Event;
};
