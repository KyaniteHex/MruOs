import { describe, expect, it } from 'vitest';
import {
  EventCreateInputSchema,
  EventUpdateInputSchema,
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
});
