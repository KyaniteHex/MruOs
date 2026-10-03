import { describe, expect, it } from 'vitest';
import { LocalStorageEventRepository } from './eventRepository';
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
});
