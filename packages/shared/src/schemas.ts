import { z } from 'zod';

const dateSchema = z.iso.date();
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const WeekdaySchema = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

export const ClassTypeSchema = z.enum([
  'wyklad',
  'cwiczenia',
  'laboratorium',
  'seminarium',
]);

export const RecurrenceSchema = z
  .object({
    freq: z.literal('WEEKLY'),
    interval: z.union([z.literal(1), z.literal(2)]),
    byDay: z.array(WeekdaySchema).min(1),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((recurrence) => recurrence.endDate >= recurrence.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  })
  .refine(
    (recurrence) => new Set(recurrence.byDay).size === recurrence.byDay.length,
    { message: 'byDay values must be unique', path: ['byDay'] },
  );

export const ExceptionOverrideSchema = z
  .object({
    subject: z.string().trim().min(1),
    classType: ClassTypeSchema,
    color: z.string().regex(/^#[\da-fA-F]{6}$/),
    building: z.string().trim().min(1),
    room: z.string().trim().min(1),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .partial()
  .refine((override) => Object.keys(override).length > 0, {
    message: 'An override must contain at least one field',
  })
  .refine(
    (override) =>
      override.startTime === undefined ||
      override.endTime === undefined ||
      override.endTime > override.startTime,
    {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    },
  );

export const EventExceptionSchema = z.union([
  z.strictObject({
    date: dateSchema,
    status: z.literal('cancelled'),
  }),
  z.strictObject({
    date: dateSchema,
    override: ExceptionOverrideSchema,
  }),
]);

export const EventSchema = z
  .object({
    kind: z.literal('class'),
    subject: z.string().trim().min(1),
    classType: ClassTypeSchema,
    color: z.string().regex(/^#[\da-fA-F]{6}$/),
    building: z.string().trim().min(1),
    room: z.string().trim().min(1),
    startTime: timeSchema,
    endTime: timeSchema,
    timezone: z.literal('Europe/Warsaw'),
    recurrence: RecurrenceSchema,
    exceptions: z.array(EventExceptionSchema).default([]),
  })
  .refine((event) => event.endTime > event.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  })
  .refine(
    (event) =>
      new Set(event.exceptions.map((exception) => exception.date)).size ===
      event.exceptions.length,
    { message: 'Exception dates must be unique', path: ['exceptions'] },
  )
  .refine(
    (event) =>
      event.exceptions.every((exception) => {
        if (!('override' in exception)) {
          return true;
        }

        const startTime = exception.override.startTime ?? event.startTime;
        const endTime = exception.override.endTime ?? event.endTime;
        return endTime > startTime;
      }),
    {
      message: 'An exception override must end after it starts',
      path: ['exceptions'],
    },
  );

export const SemesterSchema = z
  .object({
    startDate: dateSchema,
    daysOff: z.array(dateSchema),
  })
  .refine(
    (semester) => new Set(semester.daysOff).size === semester.daysOff.length,
    { message: 'daysOff dates must be unique', path: ['daysOff'] },
  );
