import { z } from 'zod';

const dateSchema = z.iso.date();
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const WeekdaySchema = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

export const ClassTypeSchema = z.enum([
  'wyklad',
  'cwiczenia',
  'laboratorium',
  'seminarium',
  'zajecia-praktyczne',
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
  .strictObject({
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

export const AcademicTermSchema = z.enum(['winter', 'summer']);

// teaching: numbers semester weeks; break and exams: informational periods;
// event: e.g. the inauguration; day-off: cancels classes like a holiday.
export const AcademicPeriodKindSchema = z.enum([
  'teaching',
  'break',
  'exams',
  'event',
  'day-off',
]);

const academicLabelSchema = z.string().trim().min(1).max(120);

export const AcademicPeriodSchema = z
  .strictObject({
    label: academicLabelSchema,
    kind: AcademicPeriodKindSchema,
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((period) => period.endDate >= period.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });

export const AcademicSemesterSchema = z
  .strictObject({
    term: AcademicTermSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    periods: z.array(AcademicPeriodSchema).max(40),
  })
  .refine((semester) => semester.endDate >= semester.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  })
  .refine(
    (semester) => {
      const teaching = semester.periods
        .filter((period) => period.kind === 'teaching')
        .sort((left, right) => left.startDate.localeCompare(right.startDate));
      return teaching.every(
        (period, index) =>
          index === 0 ||
          period.startDate > (teaching[index - 1]?.endDate ?? ''),
      );
    },
    { message: 'teaching periods must not overlap', path: ['periods'] },
  );

export const AcademicDayOffSchema = z.strictObject({
  date: dateSchema,
  label: academicLabelSchema,
});

export const AcademicYearSchema = z.strictObject({
  /** 2026 for the 2026/2027 academic year. */
  startYear: z.number().int().min(2000).max(2100),
  semesters: z
    .array(AcademicSemesterSchema)
    .max(2)
    .refine(
      (semesters) =>
        new Set(semesters.map((semester) => semester.term)).size ===
        semesters.length,
      { message: 'each term may appear once' },
    ),
  daysOff: z
    .array(AcademicDayOffSchema)
    .max(200)
    .refine(
      (daysOff) =>
        new Set(daysOff.map((dayOff) => dayOff.date)).size === daysOff.length,
      { message: 'days off must be unique' },
    ),
});

export const SemesterSchema = z
  .object({
    startDate: dateSchema,
    daysOff: z.array(dateSchema),
    /** Optional academic calendar; daysOff is derived from it when set. */
    academicYear: AcademicYearSchema.optional(),
  })
  .refine(
    (semester) => new Set(semester.daysOff).size === semester.daysOff.length,
    { message: 'daysOff dates must be unique', path: ['daysOff'] },
  );

export const EventSeriesSchema = z.object({
  id: z.string().min(1),
  event: EventSchema,
});

export const CalendarSnapshotSchema = z.object({
  events: z.array(EventSeriesSchema),
  semester: SemesterSchema,
});

export const CalendarBackupSchema = CalendarSnapshotSchema.extend({
  version: z.literal(1),
});

const emailSchema = z.string().trim().toLowerCase().email();

export const RegistrationInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(12).max(128),
});

export const LoginInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const AuthenticatedUserSchema = z.strictObject({
  id: z.string().min(1),
  email: emailSchema,
});

export const AuthResponseSchema = z.strictObject({
  user: AuthenticatedUserSchema,
});

export const EventCreateInputSchema = z.strictObject({
  id: z.string().trim().min(1).optional(),
  event: EventSchema,
});

export const EventUpdateInputSchema = z.strictObject({
  event: EventSchema,
});
