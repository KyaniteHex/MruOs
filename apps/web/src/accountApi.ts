import {
  AccountExportSchema,
  AccountInfoSchema,
  AuthResponseSchema,
  CalendarFeedSchema,
  CreatedCalendarFeedSchema,
} from '@mruos/shared';
import type {
  AccountExport,
  AccountInfo,
  AuthenticatedUser,
  CalendarFeed,
  CalendarFeedOptions,
  CreatedCalendarFeed,
} from '@mruos/shared';

// Calls to /auth, /account and /calendar-feed. Responses are validated
// before use and every failure becomes a code the pages turn into a Polish
// message.

export type AccountApiError =
  | 'invalid-credentials'
  | 'email-already-registered'
  | 'too-many-attempts'
  | 'rate-limited'
  | 'invalid-input'
  | 'invalid-password'
  | 'unauthorized'
  | 'network'
  | 'unexpected';

export type AccountApiResult<Value> =
  { success: true; value: Value } | { success: false; error: AccountApiError };

export const accountErrorMessages: Record<AccountApiError, string> = {
  'invalid-credentials': 'Nieprawidłowy adres e-mail lub hasło.',
  'email-already-registered': 'Konto z tym adresem już istnieje.',
  'too-many-attempts':
    'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za kilka minut.',
  'rate-limited': 'Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.',
  'invalid-input': 'Sprawdź poprawność wpisanych danych.',
  'invalid-password': 'Hasło jest nieprawidłowe.',
  unauthorized: 'Sesja wygasła. Zaloguj się ponownie.',
  network: 'Nie można połączyć się z serwerem. Sprawdź połączenie.',
  unexpected: 'Coś poszło nie tak. Spróbuj ponownie.',
};

const knownErrors = new Set<string>(Object.keys(accountErrorMessages));

async function errorOf(response: Response): Promise<AccountApiError> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string' &&
      knownErrors.has(body.error)
    ) {
      return body.error as AccountApiError;
    }
  } catch {
    // A body that is not JSON falls back to the status below.
  }

  return response.status === 429
    ? 'rate-limited'
    : response.status === 401
      ? 'unauthorized'
      : 'unexpected';
}

export type LoginInput = { email: string; password: string; remember: boolean };

export function createAccountApi(
  baseUrl: string,
  fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
) {
  async function call<Value>(
    path: string,
    init: RequestInit,
    parse: (body: unknown) => Value | null,
  ): Promise<AccountApiResult<Value>> {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        credentials: 'include',
        ...init,
        headers: init.body
          ? { 'Content-Type': 'application/json' }
          : init.headers,
      });
    } catch {
      return { success: false, error: 'network' };
    }

    if (!response.ok) {
      return { success: false, error: await errorOf(response) };
    }
    if (response.status === 204) {
      const empty = parse(null);
      return empty === null
        ? { success: false, error: 'unexpected' }
        : { success: true, value: empty };
    }
    try {
      const value = parse(await response.json());
      return value === null
        ? { success: false, error: 'unexpected' }
        : { success: true, value };
    } catch {
      return { success: false, error: 'unexpected' };
    }
  }

  const user = (body: unknown): AuthenticatedUser | null => {
    const parsed = AuthResponseSchema.safeParse(body);
    return parsed.success ? parsed.data.user : null;
  };
  const done = (): true => true;
  const feed = (body: unknown): CalendarFeed | null => {
    const parsed = CalendarFeedSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  };
  const json = (body: unknown) => JSON.stringify(body);

  return {
    me: () => call('/auth/me', {}, user),
    login: (input: LoginInput) =>
      call('/auth/login', { method: 'POST', body: json(input) }, user),
    register: (input: LoginInput) =>
      call('/auth/register', { method: 'POST', body: json(input) }, user),
    logout: () => call('/auth/logout', { method: 'POST' }, done),
    account: () =>
      call('/account', {}, (body): AccountInfo | null => {
        const parsed = AccountInfoSchema.safeParse(body);
        return parsed.success ? parsed.data : null;
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      call(
        '/account/password',
        { method: 'POST', body: json({ currentPassword, newPassword }) },
        done,
      ),
    logoutOthers: () =>
      call('/account/logout-others', { method: 'POST' }, done),
    exportData: () =>
      call('/account/export', {}, (body): AccountExport | null => {
        const parsed = AccountExportSchema.safeParse(body);
        return parsed.success ? parsed.data : null;
      }),
    deleteAccount: (password: string) =>
      call('/account', { method: 'DELETE', body: json({ password }) }, done),
    calendarFeed: () => call('/calendar-feed', {}, feed),
    /** A new secret link; an existing one stops working. */
    createCalendarFeed: () =>
      call(
        '/calendar-feed',
        { method: 'POST' },
        (body): CreatedCalendarFeed | null => {
          const parsed = CreatedCalendarFeedSchema.safeParse(body);
          return parsed.success ? parsed.data : null;
        },
      ),
    updateCalendarFeedOptions: (options: CalendarFeedOptions) =>
      call(
        '/calendar-feed/options',
        { method: 'PUT', body: json(options) },
        feed,
      ),
    deleteCalendarFeed: () =>
      call('/calendar-feed', { method: 'DELETE' }, done),
  };
}

export type AccountApi = ReturnType<typeof createAccountApi>;
