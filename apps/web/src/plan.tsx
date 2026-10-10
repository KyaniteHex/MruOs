import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { EntryRecord, EventSeries, Semester } from '@mruos/shared';
import { useAuth } from './authContext';
import { demoEventSeries, demoSemester } from './calendarEvents';
import {
  ApiEventRepository,
  LocalStorageEventRepository,
} from './eventRepository';
import type { EventRepository, RepositoryErrorCode } from './eventRepository';
import { PlanContext } from './planContext';
import type { PlanContextValue, PlanStatus } from './planContext';

/**
 * The plan of the signed-in student, or the guest's plan in the browser.
 * Mounted once per person (see Root), so a plan never outlives its session.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { apiBaseUrl, user, refresh } = auth;
  const [localRepository] = useState(
    () =>
      new LocalStorageEventRepository({
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: (key) => window.localStorage.removeItem(key),
      }),
  );
  const [apiRepository] = useState(() => new ApiEventRepository(apiBaseUrl));
  const [activeRepository, setActiveRepository] =
    useState<EventRepository>(localRepository);
  const [loadResult] = useState(() => localRepository.load());
  const savedSnapshot =
    loadResult.success && loadResult.value ? loadResult.value : null;
  const savedSnapshotRef = useRef(savedSnapshot);
  const [eventSeries, setEventSeries] = useState<EventSeries[]>(
    savedSnapshot?.events ?? demoEventSeries,
  );
  const [semester, setSemester] = useState<Semester>(
    savedSnapshot?.semester ?? demoSemester,
  );
  const [entries, setEntries] = useState<EntryRecord[]>(
    savedSnapshot?.entries ?? [],
  );
  const [storageError, setStorageError] = useState<RepositoryErrorCode | null>(
    loadResult.success ? null : loadResult.error,
  );
  // A signed-in student sees nothing to edit until the account's plan
  // arrives, so no change lands in the browser's plan by mistake.
  const [status, setStatus] = useState<PlanStatus>(user ? 'loading' : 'ready');
  const loadAccountPlanRef = useRef(loadAccountPlan);
  loadAccountPlanRef.current = loadAccountPlan;
  const userId = user?.id;

  // A signed-in student works on the account's plan; a guest on the local one.
  useEffect(() => {
    if (userId) {
      void loadAccountPlanRef.current();
    }
  }, [userId]);

  // A session ended elsewhere (e.g. password changed): back to the login page.
  useEffect(() => {
    if (storageError === 'unauthorized') {
      void refresh().then((signedIn) => {
        if (!signedIn) {
          navigate('/', { replace: true });
        }
      });
    }
  }, [storageError, refresh, navigate]);

  async function save(
    events: EventSeries[],
    nextSemester: Semester,
    nextEntries: EntryRecord[] = entries,
  ): Promise<boolean> {
    const result = await activeRepository.save({
      events,
      semester: nextSemester,
      entries: nextEntries,
    });

    if (!result.success) {
      setStorageError(result.error);
      return false;
    }

    if (activeRepository === localRepository) {
      savedSnapshotRef.current = {
        events,
        semester: nextSemester,
        entries: nextEntries,
      };
    }
    setEventSeries(events);
    setSemester(nextSemester);
    setEntries(nextEntries);
    setStorageError(null);
    return true;
  }

  async function loadAccountPlan(): Promise<boolean> {
    setStatus('loading');
    const remote = await apiRepository.load();
    if (!remote.success || !remote.value) {
      setStorageError(remote.success ? 'network-error' : remote.error);
      setStatus('failed');
      return false;
    }

    let snapshot = remote.value;
    const local = savedSnapshotRef.current;

    if (
      snapshot.events.length === 0 &&
      local &&
      !localRepository.isMigratedToAccount()
    ) {
      const migrated = await apiRepository.save(local);
      if (!migrated.success) {
        setStorageError(migrated.error);
        setStatus('failed');
        return false;
      }

      // The account already holds the plan; a failed marker write only risks
      // offering the same plan to an empty account again.
      localRepository.markMigratedToAccount();
      snapshot = local;
    }

    setActiveRepository(apiRepository);
    setEventSeries(snapshot.events);
    setSemester(snapshot.semester);
    setEntries(snapshot.entries);
    setStorageError(null);
    setStatus('ready');
    return true;
  }

  const value: PlanContextValue = {
    status,
    eventSeries,
    semester,
    entries,
    storageError,
    setStorageError,
    save,
    retry: loadAccountPlan,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
