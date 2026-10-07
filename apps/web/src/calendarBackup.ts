import { CalendarBackupSchema } from '@mruos/shared';
import type { CalendarSnapshot } from '@mruos/shared';
import type { RepositoryResult } from './eventRepository';

export function exportCalendarBackup(snapshot: CalendarSnapshot): string {
  const backup = CalendarBackupSchema.parse({ version: 1, ...snapshot });
  return JSON.stringify(backup, null, 2);
}

export function importCalendarBackup(
  serialized: string,
): RepositoryResult<CalendarSnapshot> {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(serialized);
  } catch {
    return { success: false, error: 'invalid-data' };
  }

  const parsedBackup = CalendarBackupSchema.safeParse(parsedValue);

  if (!parsedBackup.success) {
    return { success: false, error: 'invalid-data' };
  }

  return {
    success: true,
    value: {
      events: parsedBackup.data.events,
      semester: parsedBackup.data.semester,
      entries: parsedBackup.data.entries,
    },
  };
}
