import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { semesterFromAcademicYear, todayInWarsaw } from '@mruos/shared';
import type {
  AcademicYear,
  CalendarFeedOptions,
  ClassType,
} from '@mruos/shared';
import { AcademicYearSettings } from '../AcademicYearSettings';
import { accountErrorMessages } from '../accountApi';
import { AppHeader } from '../AppHeader';
import type { CalendarLocationState } from '../App';
import { useAuth } from '../authContext';
import { exportCalendarBackup, importCalendarBackup } from '../calendarBackup';
import type { CalendarSnapshot } from '../eventRepository';
import { defaultClassColors } from '../eventFormModel';
import { downloadFile } from '../fileDownload';
import { IcsExportDialog } from '../IcsExportDialog';
import { MenuButton } from '../MenuButton';
import { PlanStatusScreen } from '../PlanStatusScreen';
import { repositoryErrorMessages, usePlan } from '../planContext';
import { ScheduleImport } from '../ScheduleImport';
import type { ScheduleImportResult } from '../ScheduleImport';
import { readThemePreference, saveThemePreference } from '../theme';
import type { ThemePreference } from '../theme';
import { useDialogKeyboard } from '../useDialogKeyboard';
import { AccountSection, GuestAccount } from './AccountSection';
import { CalendarSubscription } from './CalendarSubscription';

const sections = [
  { id: 'plan', label: 'Plan' },
  { id: 'kalendarz-w-telefonie', label: 'Kalendarz w telefonie' },
  { id: 'wyglad', label: 'Wygląd' },
  { id: 'konto', label: 'Konto' },
];

const themes: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Jasny' },
  { value: 'dark', label: 'Ciemny' },
  { value: 'system', label: 'Jak w systemie' },
];

function formatDate(isoDate: string): string {
  return isoDate.split('-').reverse().join('.');
}

function importColor(classType: ClassType): string {
  return defaultClassColors[classType];
}

/** Settings, also for guests: the plan's data, the look and the account. */
export function SettingsPage() {
  const plan = usePlan();

  return plan.status === 'ready' ? <Settings /> : <PlanStatusScreen />;
}

function BackupConfirmation({
  error,
  onCancel,
  onConfirm,
}: {
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useDialogKeyboard(onCancel);

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal backup-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="backup-confirm-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">IMPORT KOPII</p>
            <h2 id="backup-confirm-title">Zastąpić obecny plan?</h2>
          </div>
        </header>
        <div className="event-form">
          <p>
            Zaimportowany plan, semestr oraz kolokwia, egzaminy i notatki
            zastąpią obecne dane.
          </p>
          {error && (
            <p className="form-errors" role="alert">
              {error}
            </p>
          )}
          <footer className="form-actions">
            <span className="form-action-spacer" />
            <button
              autoFocus
              className="secondary-button"
              type="button"
              onClick={onCancel}
            >
              Anuluj
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={onConfirm}
            >
              Importuj plan
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function Settings() {
  const auth = useAuth();
  const plan = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { eventSeries, semester, entries, storageError, setStorageError } =
    plan;
  const [academicYearOpen, setAcademicYearOpen] = useState(false);
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false);
  const [icsExportOpen, setIcsExportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<CalendarSnapshot | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [theme, setTheme] = useState(readThemePreference);
  const saveError = storageError
    ? repositoryErrorMessages[storageError]
    : undefined;

  // Links such as /ustawienia#konto open on their section.
  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView?.();
    }
  }, [location.hash]);

  function openCalendar(date?: string) {
    navigate('/kalendarz', {
      state: (date ? { date } : {}) satisfies CalendarLocationState,
    });
  }

  async function saveAcademicYear(academicYear: AcademicYear) {
    const nextSemester = semesterFromAcademicYear(
      academicYear,
      todayInWarsaw(),
    );
    if (await plan.save(eventSeries, nextSemester)) {
      // Saved classes keep their dates; a plan imported before the calendar
      // existed was dated from the semester start instead.
      setNotice(
        eventSeries.length > 0
          ? 'Harmonogram zapisany. Zajęcia, które już są w planie, zachowują swoje daty. Jeśli plan był importowany przed ustawieniem harmonogramu, zaimportuj go ponownie z opcją „Zastąp obecny plan”.'
          : 'Harmonogram zapisany.',
      );
      setAcademicYearOpen(false);
    }
  }

  async function exportJson() {
    setExportError(null);
    const fileName = `mruos-kopia-${todayInWarsaw()}.json`;
    if (!auth.user) {
      downloadFile(
        fileName,
        'application/json;charset=utf-8',
        exportCalendarBackup({ events: eventSeries, semester, entries }),
      );
      return;
    }

    // An account's copy also holds its details, as "download my data".
    const result = await auth.api.exportData();
    if (!result.success) {
      if (result.error === 'unauthorized') {
        void auth.refresh();
      }
      setExportError(accountErrorMessages[result.error]);
      return;
    }
    downloadFile(
      fileName,
      'application/json;charset=utf-8',
      JSON.stringify(result.value, null, 2),
    );
  }

  async function exportIcs(options: CalendarFeedOptions) {
    // Loaded on demand: the iCalendar library is only needed here.
    const { calendarIcs } = await import('@mruos/shared/ics');

    downloadFile(
      'mruos-plan.ics',
      'text/calendar;charset=utf-8',
      calendarIcs({ events: eventSeries, semester, entries }, options),
    );
    setIcsExportOpen(false);
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }

    let serialized: string;
    try {
      serialized = await file.text();
    } catch {
      setStorageError('invalid-data');
      return;
    }

    const imported = importCalendarBackup(serialized);
    if (!imported.success) {
      setStorageError(imported.error);
      return;
    }

    setStorageError(null);
    setPendingImport(imported.value);
  }

  async function confirmBackup() {
    if (!pendingImport) {
      return;
    }
    if (
      await plan.save(
        pendingImport.events,
        pendingImport.semester,
        pendingImport.entries,
      )
    ) {
      setPendingImport(null);
      openCalendar();
    }
  }

  async function importSchedule(result: ScheduleImportResult) {
    const imported = result.events.map((event) => ({
      id: crypto.randomUUID(),
      event,
    }));
    const nextSeries = result.replace
      ? imported
      : [...eventSeries, ...imported];
    const nextSemester = result.semesterStartDate
      ? { ...semester, startDate: result.semesterStartDate }
      : semester;

    if (!(await plan.save(nextSeries, nextSemester))) {
      return;
    }

    // The calendar opens on the first imported class.
    openCalendar(
      imported.map((series) => series.event.recurrence.startDate).sort()[0] ??
        nextSemester.startDate,
    );
  }

  function changeTheme(value: ThemePreference) {
    saveThemePreference(value);
    setTheme(value);
  }

  const year = semester.academicYear;

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="workspace settings-page">
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Sekcje ustawień">
            {sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.label}
              </a>
            ))}
            <Link to="/prywatnosc">Prywatność</Link>
          </nav>

          <div className="settings-content">
            <p>
              <Link to="/kalendarz">← Wróć do kalendarza</Link>
            </p>
            <h1>Ustawienia</h1>

            <section
              className="settings-section"
              id="plan"
              aria-labelledby="plan-title"
            >
              <h2 id="plan-title">Plan</h2>
              {notice && (
                <p className="auth-notice" role="status">
                  {notice}
                </p>
              )}
              {storageError && !pendingImport && (
                <p className="form-errors" role="alert">
                  {repositoryErrorMessages[storageError]}
                </p>
              )}

              <div className="settings-row">
                <div>
                  <h3>Rok akademicki</h3>
                  <p className="field-hint">
                    {year
                      ? `Harmonogram ${year.startYear}/${year.startYear + 1}: okresy zajęć, przerw i sesji oraz ${year.daysOff.length} dni wolnych.`
                      : `Bez harmonogramu: tygodnie planu liczone od ${formatDate(semester.startDate)}.`}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setAcademicYearOpen(true)}
                >
                  {year ? 'Edytuj harmonogram' : 'Ustaw harmonogram'}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <h3>Import i eksport</h3>
                  <p className="field-hint">
                    Format JSON to kopia całego planu, którą wczytasz w innej
                    przeglądarce albo na koncie. Format ICS otworzy Kalendarz
                    Google, Apple lub Outlook.
                  </p>
                </div>
                <div className="settings-actions">
                  <MenuButton
                    items={[
                      {
                        label: 'Format JSON',
                        onSelect: () => backupInputRef.current?.click(),
                      },
                      {
                        label: 'Format XLSX (UMK CM)',
                        onSelect: () => setScheduleImportOpen(true),
                      },
                    ]}
                  >
                    Import
                  </MenuButton>
                  <MenuButton
                    items={[
                      {
                        label: 'Format JSON',
                        onSelect: () => void exportJson(),
                      },
                      {
                        label: 'Format ICS',
                        onSelect: () => setIcsExportOpen(true),
                      },
                    ]}
                  >
                    Eksport
                  </MenuButton>
                </div>
                <input
                  ref={backupInputRef}
                  accept="application/json,.json"
                  aria-label="Plik kopii planu (JSON)"
                  className="visually-hidden"
                  onChange={(event) => void chooseBackup(event)}
                  tabIndex={-1}
                  type="file"
                />
              </div>
              {exportError && (
                <p className="form-errors" role="alert">
                  {exportError}
                </p>
              )}
            </section>

            <section
              className="settings-section"
              id="kalendarz-w-telefonie"
              aria-labelledby="feed-title"
            >
              <h2 id="feed-title">Kalendarz w telefonie</h2>
              {auth.user ? (
                <CalendarSubscription
                  api={auth.api}
                  apiBaseUrl={auth.apiBaseUrl}
                  onUnauthorized={auth.refresh}
                />
              ) : (
                <p className="field-hint">
                  Subskrypcja, z którą plan sam aktualizuje się w Kalendarzu
                  Google, na iPhonie albo na Macu, wymaga konta.{' '}
                  <Link to="/rejestracja">Załóż konto</Link> albo{' '}
                  <Link to="/">zaloguj się</Link>.
                </p>
              )}
            </section>

            <section
              className="settings-section"
              id="wyglad"
              aria-labelledby="look-title"
            >
              <h2 id="look-title">Wygląd</h2>
              <fieldset className="form-section">
                <legend>Motyw</legend>
                <div className="range-options">
                  {themes.map((option) => (
                    <label
                      className={theme === option.value ? 'is-selected' : ''}
                      key={option.value}
                    >
                      <input
                        checked={theme === option.value}
                        name="theme"
                        onChange={() => changeTheme(option.value)}
                        type="radio"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  Zapamiętany na tym urządzeniu. „Jak w systemie” dopasowuje się
                  do ustawień telefonu albo komputera.
                </p>
              </fieldset>
            </section>

            <section
              className="settings-section"
              id="konto"
              aria-labelledby="account-title"
            >
              <h2 id="account-title">Konto</h2>
              {auth.user ? <AccountSection /> : <GuestAccount />}
            </section>

            <p className="settings-footer">
              <Link to="/prywatnosc">Prywatność</Link>
            </p>
          </div>
        </div>
      </main>

      {academicYearOpen && (
        <AcademicYearSettings
          semester={semester}
          today={todayInWarsaw()}
          saveError={saveError}
          onCancel={() => setAcademicYearOpen(false)}
          onSave={(academicYear) => void saveAcademicYear(academicYear)}
        />
      )}
      {scheduleImportOpen && (
        <ScheduleImport
          semester={semester}
          existingSeries={eventSeries}
          colorFor={importColor}
          saveError={saveError}
          onCancel={() => setScheduleImportOpen(false)}
          onImport={(result) => void importSchedule(result)}
          onOpenAcademicYear={() => {
            setScheduleImportOpen(false);
            setAcademicYearOpen(true);
          }}
        />
      )}
      {icsExportOpen && (
        <IcsExportDialog
          onShowSubscription={
            auth.user
              ? () => {
                  setIcsExportOpen(false);
                  document
                    .getElementById('kalendarz-w-telefonie')
                    ?.scrollIntoView?.();
                }
              : undefined
          }
          onCancel={() => setIcsExportOpen(false)}
          onExport={(options) => void exportIcs(options)}
        />
      )}
      {pendingImport && (
        <BackupConfirmation
          error={saveError}
          onCancel={() => setPendingImport(null)}
          onConfirm={() => void confirmBackup()}
        />
      )}
    </div>
  );
}
