import { createContext, useContext } from 'react';
import type { EntryRecord, EventSeries, Semester } from '@mruos/shared';
import type { RepositoryErrorCode } from './eventRepository';

/** loading and failed happen only while an account's plan is fetched. */
export type PlanStatus = 'loading' | 'ready' | 'failed';

export type PlanContextValue = {
  status: PlanStatus;
  eventSeries: EventSeries[];
  semester: Semester;
  entries: EntryRecord[];
  storageError: RepositoryErrorCode | null;
  setStorageError: (error: RepositoryErrorCode | null) => void;
  /** Saves the whole plan; entries stay as they are unless given. */
  save: (
    events: EventSeries[],
    semester: Semester,
    entries?: EntryRecord[],
  ) => Promise<boolean>;
  /** Fetches the account's plan again, e.g. after a failure. */
  retry: () => Promise<boolean>;
};

export const repositoryErrorMessages: Record<RepositoryErrorCode, string> = {
  'read-error': 'Nie można odczytać kalendarza z pamięci przeglądarki.',
  'invalid-data': 'Zapisane dane są uszkodzone lub mają nieobsługiwaną wersję.',
  'write-error':
    'Nie udało się zapisać kalendarza. Sprawdź wolne miejsce w przeglądarce.',
  'clear-error': 'Nie udało się wyczyścić lokalnego zapisu.',
  unauthorized: 'Zaloguj się, aby kontynuować pracę z kontem.',
  'network-error': 'Nie można połączyć się z API. Spróbuj ponownie.',
  'server-updating':
    'Serwer jest właśnie aktualizowany i nie zapisał kolokwiów, egzaminów ani notatek. Spróbuj ponownie za kilka minut.',
};

export const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used inside PlanProvider');
  }

  return context;
}
