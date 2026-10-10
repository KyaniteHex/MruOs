import { describe, expect, it } from 'vitest';
import {
  AccountExportSchema,
  CalendarBackupSchema,
  CalendarFeedOptionsSchema,
  ChangePasswordInputSchema,
  CreatedCalendarFeedSchema,
  DeleteAccountInputSchema,
  EventCreateInputSchema,
  EventUpdateInputSchema,
  HealthSchema,
  LoginInputSchema,
  RegistrationInputSchema,
} from './schemas.js';

describe('API input schemas', () => {
  it('normalizes account emails and validates registration passwords', () => {
    const result = RegistrationInputSchema.parse({
      email: '  STUDENT@example.com ',
      password: 'long-enough-password',
    });

    expect(result.email).toBe('student@example.com');
    expect(
      RegistrationInputSchema.safeParse({
        email: 'student@example.com',
        password: 'short',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown auth and event payload fields', () => {
    expect(
      LoginInputSchema.safeParse({
        email: 'student@example.com',
        password: 'secret',
        isAdmin: true,
      }).success,
    ).toBe(false);
    expect(
      EventCreateInputSchema.safeParse({
        id: 'series-1',
        event: {},
        userId: 'other',
      }).success,
    ).toBe(false);
    expect(
      EventUpdateInputSchema.safeParse({ event: {}, userId: 'other' }).success,
    ).toBe(false);
  });

  it('defaults "Nie wylogowuj mnie" to a browser session', () => {
    expect(
      LoginInputSchema.parse({ email: 'a@example.com', password: 'secret' })
        .remember,
    ).toBe(false);
    expect(
      RegistrationInputSchema.parse({
        email: 'a@example.com',
        password: 'long-enough-password',
        remember: true,
      }).remember,
    ).toBe(true);
  });

  it('validates password changes and account deletion', () => {
    expect(
      ChangePasswordInputSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'short',
      }).success,
    ).toBe(false);
    expect(
      ChangePasswordInputSchema.safeParse({
        currentPassword: 'old',
        newPassword: 'a-long-new-password',
      }).success,
    ).toBe(true);
    expect(DeleteAccountInputSchema.safeParse({ password: '' }).success).toBe(
      false,
    );
  });
});

describe('AccountExportSchema', () => {
  it('can be imported back as a calendar backup', () => {
    const exported = AccountExportSchema.parse({
      version: 1,
      exportedAt: '2026-10-06T08:00:00.000Z',
      account: {
        email: 'student@example.com',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      events: [],
      semester: { startDate: '2026-10-01', daysOff: [] },
    });

    expect(CalendarBackupSchema.safeParse(exported).success).toBe(true);
  });
});

describe('calendar subscription schemas', () => {
  const options = {
    assessments: true,
    notes: false,
    daysOff: false,
    periods: false,
  };

  it('accepts a new subscription with a 43-character token', () => {
    expect(
      CreatedCalendarFeedSchema.safeParse({
        active: true,
        createdAt: '2026-10-07T12:00:00.000Z',
        options,
        token: 'a'.repeat(42) + '-',
      }).success,
    ).toBe(true);
    expect(
      CreatedCalendarFeedSchema.safeParse({
        active: true,
        options,
        token: 'too-short',
      }).success,
    ).toBe(false);
  });

  it('accepts only the four known options', () => {
    expect(CalendarFeedOptionsSchema.safeParse(options).success).toBe(true);
    expect(
      CalendarFeedOptionsSchema.safeParse({ ...options, extra: true }).success,
    ).toBe(false);
    expect(
      CalendarFeedOptionsSchema.safeParse({ assessments: true }).success,
    ).toBe(false);
  });

  it('reads the health of the API with or without its version', () => {
    expect(HealthSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(HealthSchema.parse({ status: 'ok', version: 'd5b820c' })).toEqual({
      status: 'ok',
      version: 'd5b820c',
    });
    expect(HealthSchema.safeParse({ status: 'down' }).success).toBe(false);
  });
});
