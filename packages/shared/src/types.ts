import type { DateTime } from 'luxon';
import type {
  AcademicDayOffSchema,
  AcademicPeriodKindSchema,
  AcademicPeriodSchema,
  AcademicSemesterSchema,
  AcademicTermSchema,
  AcademicYearSchema,
  AccountExportSchema,
  AccountInfoSchema,
  AssessmentKindSchema,
  AssessmentSchema,
  ChangePasswordInputSchema,
  ClassAnchorSchema,
  ClassTypeSchema,
  DeleteAccountInputSchema,
  CalendarBackupSchema,
  CalendarSnapshotSchema,
  AuthenticatedUserSchema,
  AuthResponseSchema,
  EventExceptionSchema,
  EventCreateInputSchema,
  EventSchema,
  EventSeriesSchema,
  EventUpdateInputSchema,
  EntryRecordSchema,
  EntrySchema,
  ExceptionOverrideSchema,
  LoginInputSchema,
  NoteSchema,
  OwnTimeAnchorSchema,
  RegistrationInputSchema,
  RecurrenceSchema,
  ReminderSchema,
  SubjectAnchorSchema,
  SemesterSchema,
  WeekdaySchema,
} from './schemas.js';
import type { z } from 'zod';

export type Weekday = z.infer<typeof WeekdaySchema>;
export type AcademicTerm = z.infer<typeof AcademicTermSchema>;
export type AcademicPeriodKind = z.infer<typeof AcademicPeriodKindSchema>;
export type AcademicPeriod = z.infer<typeof AcademicPeriodSchema>;
export type AcademicSemester = z.infer<typeof AcademicSemesterSchema>;
export type AcademicDayOff = z.infer<typeof AcademicDayOffSchema>;
export type AcademicYear = z.infer<typeof AcademicYearSchema>;
export type AccountInfo = z.infer<typeof AccountInfoSchema>;
export type AccountExport = z.infer<typeof AccountExportSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;
export type ClassType = z.infer<typeof ClassTypeSchema>;
export type EventSeries = z.infer<typeof EventSeriesSchema>;
export type CalendarSnapshot = z.infer<typeof CalendarSnapshotSchema>;
export type CalendarBackup = z.infer<typeof CalendarBackupSchema>;
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type Recurrence = z.infer<typeof RecurrenceSchema>;
export type ExceptionOverride = z.infer<typeof ExceptionOverrideSchema>;
export type EventException = z.infer<typeof EventExceptionSchema>;
export type Event = z.infer<typeof EventSchema>;
export type EventCreateInput = z.infer<typeof EventCreateInputSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateInputSchema>;
export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type Semester = z.infer<typeof SemesterSchema>;
export type ClassAnchor = z.infer<typeof ClassAnchorSchema>;
export type OwnTimeAnchor = z.infer<typeof OwnTimeAnchorSchema>;
export type SubjectAnchor = z.infer<typeof SubjectAnchorSchema>;
export type Reminder = z.infer<typeof ReminderSchema>;
export type AssessmentKind = z.infer<typeof AssessmentKindSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type EntryRecord = z.infer<typeof EntryRecordSchema>;

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
