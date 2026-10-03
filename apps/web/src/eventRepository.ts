import { CalendarBackupSchema } from '@mruos/shared';
import type { CalendarSnapshot } from '@mruos/shared';

export type { CalendarSnapshot, EventSeries } from '@mruos/shared';

export type RepositoryErrorCode =
  'read-error' | 'invalid-data' | 'write-error' | 'clear-error';

export type RepositoryResult<Value> =
  | { success: true; value: Value }
  | { success: false; error: RepositoryErrorCode };

export interface EventRepository {
  load(): RepositoryResult<CalendarSnapshot | null>;
  save(snapshot: CalendarSnapshot): RepositoryResult<void>;
  clear(): RepositoryResult<void>;
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
}
