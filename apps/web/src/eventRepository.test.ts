import { describe, expect, it } from 'vitest';
import {
  ApiEventRepository,
  LocalStorageEventRepository,
} from './eventRepository';
import type { StoragePort } from './eventRepository';

class MemoryStorage implements StoragePort {
  private readonly entries = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('Storage full');
    }

    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const snapshot = {
  events: [
    {
      id: 'series-1',
      event: {
        kind: 'class' as const,
        subject: 'Matematyka',
        classType: 'wyklad' as const,
        color: '#25745b',
        building: 'Wydział Matematyki',
        room: '204',
        startTime: '08:00',
        endTime: '10:00',
        timezone: 'Europe/Warsaw' as const,
        recurrence: {
          freq: 'WEEKLY' as const,
          interval: 1 as const,
          byDay: ['MO' as const],
          startDate: '2026-10-05',
          endDate: '2026-11-02',
        },
        exceptions: [],
      },
    },
  ],
  semester: { startDate: '2026-09-28', daysOff: ['2026-11-11'] },
  entries: [
    {
      id: 'entry-1',
      entry: {
        kind: 'note' as const,
        subject: 'Matematyka',
        text: 'Przynieść kalkulator',
        anchor: { type: 'subject' as const },
      },
    },
  ],
};

describe('LocalStorageEventRepository', () => {
  it('returns an empty result for a new storage key and round-trips data', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageEventRepository(storage);

    expect(repository.load()).toEqual({ success: true, value: null });
    expect(repository.save(snapshot)).toEqual({
      success: true,
      value: undefined,
    });
    expect(repository.load()).toEqual({ success: true, value: snapshot });
  });

  it('reports invalid JSON and schema-invalid data without clearing it', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageEventRepository(storage);

    storage.setItem('mruos-calendar-v1', '{broken');
    expect(repository.load()).toEqual({
      success: false,
      error: 'invalid-data',
    });

    storage.setItem('mruos-calendar-v1', JSON.stringify({ version: 99 }));
    expect(repository.load()).toEqual({
      success: false,
      error: 'invalid-data',
    });
    expect(storage.getItem('mruos-calendar-v1')).toBe(
      JSON.stringify({ version: 99 }),
    );
  });

  it('reports storage write failures and supports clearing saved data', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageEventRepository(storage);
    storage.failWrites = true;

    expect(repository.save(snapshot)).toEqual({
      success: false,
      error: 'write-error',
    });

    storage.failWrites = false;
    repository.save(snapshot);
    expect(repository.clear()).toEqual({ success: true, value: undefined });
    expect(repository.load()).toEqual({ success: true, value: null });
  });

  it('remembers that the local plan was moved to an account', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageEventRepository(storage);
    repository.save(snapshot);

    expect(repository.isMigratedToAccount()).toBe(false);
    expect(repository.markMigratedToAccount()).toEqual({
      success: true,
      value: undefined,
    });
    expect(repository.isMigratedToAccount()).toBe(true);
    expect(repository.load()).toEqual({ success: true, value: snapshot });
  });
});

describe('ApiEventRepository', () => {
  it('loads a validated snapshot with cookie credentials', async () => {
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify(snapshot), { status: 200 });
    };
    const repository = new ApiEventRepository('/api', fetcher);

    expect(await repository.load()).toEqual({ success: true, value: snapshot });
    expect(requestInit?.credentials).toBe('include');
  });

  it('maps unauthorized and network failures to repository errors', async () => {
    const unauthorized = new ApiEventRepository(
      '/api',
      async () => new Response(null, { status: 401 }),
    );
    const offline = new ApiEventRepository('/api', async () => {
      throw new Error('Network unavailable');
    });

    expect(await unauthorized.load()).toEqual({
      success: false,
      error: 'unauthorized',
    });
    expect(await offline.load()).toEqual({
      success: false,
      error: 'network-error',
    });
  });

  it('saves a snapshot using the authenticated calendar endpoint', async () => {
    let requestUrl: RequestInfo | URL | undefined;
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = input;
      requestInit = init;
      return new Response(String(init?.body), { status: 200 });
    };
    const repository = new ApiEventRepository('/api', fetcher);

    expect(await repository.save(snapshot)).toEqual({
      success: true,
      value: undefined,
    });
    expect(requestUrl).toBe('/api/calendar');
    expect(requestInit?.method).toBe('PUT');
    expect(JSON.parse(String(requestInit?.body))).toEqual(snapshot);
  });

  it('reports entries that an older server did not keep', async () => {
    const withoutEntries = {
      events: snapshot.events,
      semester: snapshot.semester,
    };
    const repository = new ApiEventRepository(
      '/api',
      async () => new Response(JSON.stringify(withoutEntries), { status: 200 }),
    );

    expect(await repository.save(snapshot)).toEqual({
      success: false,
      error: 'server-updating',
    });
    expect(await repository.save({ ...snapshot, entries: [] })).toEqual({
      success: true,
      value: undefined,
    });
  });
});
