import { CalendarBackupSchema } from '@mruos/shared';
import { CalendarSnapshotSchema } from '@mruos/shared';
import type { CalendarSnapshot } from '@mruos/shared';

export type { CalendarSnapshot, EventSeries } from '@mruos/shared';

export type RepositoryErrorCode =
  | 'read-error'
  | 'invalid-data'
  | 'write-error'
  | 'clear-error'
  | 'unauthorized'
  | 'network-error'
  | 'server-updating';

export type RepositoryResult<Value> =
  | { success: true; value: Value }
  | { success: false; error: RepositoryErrorCode };

export type RepositoryCall<Value> =
  RepositoryResult<Value> | Promise<RepositoryResult<Value>>;

export interface EventRepository {
  load(): RepositoryCall<CalendarSnapshot | null>;
  save(snapshot: CalendarSnapshot): RepositoryCall<void>;
  clear(): RepositoryCall<void>;
}

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageEventRepository implements EventRepository {
  constructor(
    private readonly storage: StoragePort,
    private readonly key = 'mruos-calendar-v1',
  ) {}

  load(): RepositoryResult<CalendarSnapshot | null> {
    let rawValue: string | null;

    try {
      rawValue = this.storage.getItem(this.key);
    } catch {
      return { success: false, error: 'read-error' };
    }

    if (rawValue === null) {
      return { success: true, value: null };
    }

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      return { success: false, error: 'invalid-data' };
    }

    const parsedSnapshot = CalendarBackupSchema.safeParse(parsedValue);

    if (!parsedSnapshot.success) {
      return { success: false, error: 'invalid-data' };
    }

    return {
      success: true,
      value: {
        events: parsedSnapshot.data.events,
        semester: parsedSnapshot.data.semester,
        entries: parsedSnapshot.data.entries,
      },
    };
  }

  save(snapshot: CalendarSnapshot): RepositoryResult<void> {
    const parsedSnapshot = CalendarBackupSchema.safeParse({
      version: 1,
      ...snapshot,
    });

    if (!parsedSnapshot.success) {
      return { success: false, error: 'invalid-data' };
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(parsedSnapshot.data));
    } catch {
      return { success: false, error: 'write-error' };
    }

    return { success: true, value: undefined };
  }

  clear(): RepositoryResult<void> {
    try {
      this.storage.removeItem(this.key);
    } catch {
      return { success: false, error: 'clear-error' };
    }

    return { success: true, value: undefined };
  }

  // The local plan is moved to an account at most once per browser, so an
  // emptied or a different account never receives it again.
  isMigratedToAccount(): boolean {
    try {
      return this.storage.getItem(`${this.key}:migrated`) !== null;
    } catch {
      return false;
    }
  }

  markMigratedToAccount(): RepositoryResult<void> {
    try {
      this.storage.setItem(`${this.key}:migrated`, 'true');
    } catch {
      return { success: false, error: 'write-error' };
    }

    return { success: true, value: undefined };
  }
}

export class ApiEventRepository implements EventRepository {
  private readonly fetcher: typeof fetch;

  constructor(
    private readonly baseUrl = '/api',
    fetcher?: typeof fetch,
  ) {
    this.fetcher = fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async load(): Promise<RepositoryResult<CalendarSnapshot | null>> {
    let response: Response;

    try {
      response = await this.fetcher(`${this.baseUrl}/calendar`, {
        credentials: 'include',
      });
    } catch {
      return { success: false, error: 'network-error' };
    }

    if (response.status === 401) {
      return { success: false, error: 'unauthorized' };
    }
    if (!response.ok) {
      return { success: false, error: 'network-error' };
    }

    try {
      const parsed = CalendarSnapshotSchema.safeParse(await response.json());
      return parsed.success
        ? { success: true, value: parsed.data }
        : { success: false, error: 'invalid-data' };
    } catch {
      return { success: false, error: 'invalid-data' };
    }
  }

  async save(snapshot: CalendarSnapshot): Promise<RepositoryResult<void>> {
    if (!CalendarSnapshotSchema.safeParse(snapshot).success) {
      return { success: false, error: 'invalid-data' };
    }

    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/calendar`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    } catch {
      return { success: false, error: 'network-error' };
    }

    if (response.status === 401) {
      return { success: false, error: 'unauthorized' };
    }
    if (!response.ok) {
      return { success: false, error: 'write-error' };
    }

    // While a release goes out, the API may still be a version that drops
    // entries without a word; it answers without them.
    if (snapshot.entries.length > 0) {
      const saved: unknown = await response.json().catch(() => null);
      if (
        typeof saved !== 'object' ||
        saved === null ||
        !('entries' in saved)
      ) {
        return { success: false, error: 'server-updating' };
      }
    }

    return { success: true, value: undefined };
  }

  async clear(): Promise<RepositoryResult<void>> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/calendar`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      return { success: false, error: 'network-error' };
    }

    if (response.status === 401) {
      return { success: false, error: 'unauthorized' };
    }

    return response.ok
      ? { success: true, value: undefined }
      : { success: false, error: 'clear-error' };
  }
}
