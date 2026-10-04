import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type {
  EventClickArg,
  EventContentArg,
  EventSourceFuncArg,
} from '@fullcalendar/core';
import plLocale from '@fullcalendar/core/locales/pl';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  AuthResponseSchema,
  EventSchema,
  expandOccurrences,
  semesterFromAcademicYear,
  todayInWarsaw,
} from '@mruos/shared';
import type { AcademicYear, AuthenticatedUser } from '@mruos/shared';
import type { ClassType, Event, Semester } from '@mruos/shared';
import { semesterWeeksToDateRange } from '@mruos/shared/semester';
import { AccountPanel } from './AccountPanel';
import { EventForm } from './EventForm';
import { AcademicYearSettings } from './AcademicYearSettings';
import { periodKindLabels } from './academicYearForm';
import { DialogKeyboard } from './useDialogKeyboard';
import { ScheduleImport } from './ScheduleImport';
import type { ScheduleImportResult } from './ScheduleImport';
import { classTypeLabels, defaultClassColors } from './eventFormModel';
import type { EventEditScope } from './eventFormModel';
import type {
  AnnotationDetails,
  CalendarEventDetails,
  EventSeries,
} from './calendarEvents';
import {
  demoEventSeries,
  demoRange,
  demoSemester,
  toAnnotationEvents,
  toCalendarEvents,
} from './calendarEvents';
import { exportCalendarBackup, importCalendarBackup } from './calendarBackup';
import { downloadFile } from './fileDownload';
import {
  ApiEventRepository,
  LocalStorageEventRepository,
} from './eventRepository';
import type {
  CalendarSnapshot,
  EventRepository,
  RepositoryErrorCode,
} from './eventRepository';

type SelectedEvent = CalendarEventDetails & {
  title: string;
};

type FormSession =
  | { mode: 'create'; initialDate: string }
  | {
      mode: 'edit';
      initialEvent: Event;
      occurrenceEvent: Event;
      occurrenceDate: string;
      seriesId: string;
    };

function importColor(classType: ClassType): string {
  return defaultClassColors[classType];
}

function isAnnotation(props: Record<string, unknown>): boolean {
  return (props as Partial<AnnotationDetails>).annotation === true;
}

function renderEventContent(info: EventContentArg) {
  if (isAnnotation(info.event.extendedProps)) {
    const { kind, label } = info.event.extendedProps as AnnotationDetails;
    // Month cells are narrow: show the name; the colour marks a day off.
    const prefix =
      kind === 'day-off' && label !== 'Dzień wolny' ? 'Dzień wolny: ' : '';
    const showPrefix = info.view.type === 'timeGridDay';

    return (
      <div className="calendar-annotation-copy" title={info.event.title}>
        {prefix && (
          <span className={showPrefix ? undefined : 'visually-hidden'}>
            {prefix}
          </span>
        )}
        {label}
      </div>
    );
  }

  const details = info.event.extendedProps as CalendarEventDetails;
  const isDayView = info.view.type === 'timeGridDay';

  return (
    <div className="calendar-event-copy">
      <div className="calendar-event-primary">
        <span>{info.timeText}</span>
        <strong>{info.event.title}</strong>
      </div>
      <span className="calendar-event-location">
        {isDayView ? `${details.room} · ${details.building}` : details.room}
      </span>
    </div>
  );
}

const repositoryErrorMessages: Record<RepositoryErrorCode, string> = {
  'read-error': 'Nie można odczytać kalendarza z pamięci przeglądarki.',
  'invalid-data': 'Zapisane dane są uszkodzone lub mają nieobsługiwaną wersję.',
  'write-error':
    'Nie udało się zapisać kalendarza. Sprawdź wolne miejsce w przeglądarce.',
  'clear-error': 'Nie udało się wyczyścić lokalnego zapisu.',
  unauthorized: 'Zaloguj się, aby kontynuować pracę z kontem.',
  'network-error': 'Nie można połączyć się z API. Spróbuj ponownie.',
};

export function App() {
  const calendarRef = useRef<FullCalendar>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
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
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<AnnotationDetails | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(
    null,
  );
  const [eventSeries, setEventSeries] = useState<EventSeries[]>(
    savedSnapshot?.events ?? demoEventSeries,
  );
  const [semester, setSemester] = useState<Semester>(
    savedSnapshot?.semester ?? demoSemester,
  );
  const [formSession, setFormSession] = useState<FormSession | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<CalendarSnapshot | null>(
    null,
  );
  const [storageError, setStorageError] = useState<RepositoryErrorCode | null>(
    loadResult.success ? null : loadResult.error,
  );
  const [activeDate, setActiveDate] = useState(
    savedSnapshot?.semester.startDate ?? demoRange.startDate,
  );
  const semesterEndDate = semesterWeeksToDateRange(semester, 1, 20).endDate;
  const handleAuthenticatedRef = useRef(handleAuthenticated);
  handleAuthenticatedRef.current = handleAuthenticated;
  const authRestorePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [eventSeries, semester]);

  useEffect(() => {
    if (authRestorePromiseRef.current) {
      return;
    }

    authRestorePromiseRef.current = (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        if (!response.ok) {
          return;
        }

        const result = AuthResponseSchema.safeParse(await response.json());
        if (result.success) {
          await handleAuthenticatedRef.current(result.data.user);
        }
      } catch {
        return;
      }
    })();
  }, [apiBaseUrl]);

  async function persistSnapshot(
    events: EventSeries[],
    nextSemester: Semester,
  ): Promise<boolean> {
    const result = await activeRepository.save({
      events,
      semester: nextSemester,
    });

    if (!result.success) {
      setStorageError(result.error);
      return false;
    }

    if (activeRepository === localRepository) {
      savedSnapshotRef.current = {
        events,
        semester: nextSemester,
      };
    }
    setEventSeries(events);
    setSemester(nextSemester);
    setStorageError(null);
    return true;
  }

  async function handleAuthenticated(
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const remote = await apiRepository.load();
    if (!remote.success || !remote.value) {
      setStorageError(remote.success ? 'network-error' : remote.error);
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
    setActiveDate(snapshot.semester.startDate);
    calendarRef.current?.getApi().gotoDate(snapshot.semester.startDate);
    setAuthUser(user);
    setStorageError(null);
    return true;
  }

  function handleLogout() {
    const local = savedSnapshotRef.current;
    setActiveRepository(localRepository);
    setAuthUser(null);
    setEventSeries(local?.events ?? demoEventSeries);
    setSemester(local?.semester ?? demoSemester);
    setActiveDate(local?.semester.startDate ?? demoRange.startDate);
    calendarRef.current
      ?.getApi()
      .gotoDate(local?.semester.startDate ?? demoRange.startDate);
    setStorageError(loadResult.success ? null : loadResult.error);
  }

  function handleDateClick(info: { dateStr: string }) {
    setActiveDate(info.dateStr);
    setSelectedEvent(null);
    setSelectedAnnotation(null);
    calendarRef.current?.getApi().changeView('timeGridDay', info.dateStr);
  }

  function handleEventClick(info: EventClickArg) {
    if (isAnnotation(info.event.extendedProps)) {
      // Narrow month cells cut long names; the panel shows them in full.
      setSelectedEvent(null);
      setSelectedAnnotation(info.event.extendedProps as AnnotationDetails);
      return;
    }
    const details = info.event.extendedProps as CalendarEventDetails;

    setSelectedAnnotation(null);
    setSelectedEvent({
      ...details,
      title: info.event.title,
    });
  }

  function openEditForm() {
    if (!selectedEvent) {
      return;
    }

    const series = eventSeries.find(
      (candidate) => candidate.id === selectedEvent.seriesId,
    );

    if (!series) {
      return;
    }

    const occurrenceEvent =
      expandOccurrences(
        series.event,
        {
          startDate: selectedEvent.date,
          endDate: selectedEvent.date,
        },
        semester,
      )[0]?.event ?? series.event;

    setFormSession({
      mode: 'edit',
      initialEvent: series.event,
      occurrenceEvent,
      occurrenceDate: selectedEvent.date,
      seriesId: series.id,
    });
  }

  async function handleFormSave(event: Event, scope: EventEditScope) {
    if (!formSession) {
      return;
    }

    if (formSession.mode === 'create') {
      const nextSeries = [...eventSeries, { id: crypto.randomUUID(), event }];
      if (!(await persistSnapshot(nextSeries, semester))) {
        return;
      }
    } else {
      const nextSeries = eventSeries.map((series) => {
        if (series.id !== formSession.seriesId) {
          return series;
        }

        const updatedEvent =
          scope === 'occurrence'
            ? EventSchema.parse({
                ...series.event,
                exceptions: event.exceptions,
              })
            : event;

        return { ...series, event: updatedEvent };
      });
      if (!(await persistSnapshot(nextSeries, semester))) {
        return;
      }
    }

    setFormSession(null);
    setSelectedEvent(null);
  }

  async function handleFormDelete(scope: EventEditScope) {
    if (formSession?.mode !== 'edit') {
      return;
    }

    const nextSeries =
      scope === 'series'
        ? eventSeries.filter((series) => series.id !== formSession.seriesId)
        : eventSeries.map((series) => {
            if (series.id !== formSession.seriesId) return series;

            const exceptions = [
              ...series.event.exceptions.filter(
                (exception) => exception.date !== formSession.occurrenceDate,
              ),
              {
                date: formSession.occurrenceDate,
                status: 'cancelled' as const,
              },
            ];

            return {
              ...series,
              event: EventSchema.parse({
                ...series.event,
                exceptions,
              }),
            };
          });

    if (!(await persistSnapshot(nextSeries, semester))) {
      return;
    }

    setFormSession(null);
    setSelectedEvent(null);
  }

  async function handleAcademicYearSave(academicYear: AcademicYear) {
    const nextSemester = semesterFromAcademicYear(
      academicYear,
      todayInWarsaw(),
    );
    if (await persistSnapshot(eventSeries, nextSemester)) {
      // Saved classes keep their dates; a plan imported before the calendar
      // existed was dated from the semester start instead.
      setNotice(
        eventSeries.length > 0
          ? 'Harmonogram zapisany. Zajęcia, które już są w planie, zachowują swoje daty. Jeśli plan był importowany przed ustawieniem harmonogramu, zaimportuj go ponownie z opcją „Zastąp obecny plan”.'
          : null,
      );
      setActiveDate(nextSemester.startDate);
      calendarRef.current?.getApi().gotoDate(nextSemester.startDate);
      setSettingsOpen(false);
    }
  }

  function handleExportJson() {
    downloadFile(
      'mruos-plan.json',
      'application/json;charset=utf-8',
      exportCalendarBackup({ events: eventSeries, semester }),
    );
  }

  async function handleExportIcs() {
    const { exportCalendarIcs } = await import('./calendarIcs');

    downloadFile(
      'mruos-plan.ics',
      'text/calendar;charset=utf-8',
      exportCalendarIcs(eventSeries, semester.daysOff),
    );
  }

  async function handleImportJson(event: ChangeEvent<HTMLInputElement>) {
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

  async function confirmImport() {
    if (!pendingImport) {
      return;
    }

    if (
      !(await persistSnapshot(pendingImport.events, pendingImport.semester))
    ) {
      return;
    }

    setPendingImport(null);
    setSelectedEvent(null);
    setFormSession(null);
    setActiveDate(pendingImport.semester.startDate);
    calendarRef.current?.getApi().gotoDate(pendingImport.semester.startDate);
  }

  async function handleScheduleImport(result: ScheduleImportResult) {
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

    if (!(await persistSnapshot(nextSeries, nextSemester))) {
      return;
    }

    const firstDate =
      imported.map((series) => series.event.recurrence.startDate).sort()[0] ??
      nextSemester.startDate;
    setScheduleImportOpen(false);
    setNotice(null);
    setSelectedEvent(null);
    setActiveDate(firstDate);
    calendarRef.current?.getApi().gotoDate(firstDate);
  }

  async function handleRestoreDemo() {
    if (await persistSnapshot(demoEventSeries, demoSemester)) {
      setActiveDate(demoRange.startDate);
      calendarRef.current?.getApi().gotoDate(demoRange.startDate);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MruOS, strona główna">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>MruOS</span>
        </a>
        <div className="topbar-term">
          <div className="term-label">
            <span className="term-dot" aria-hidden="true" />
            Semestr od <span className="term-year">{semester.startDate}</span>
          </div>
          <AccountPanel
            user={authUser}
            apiBaseUrl={apiBaseUrl}
            onAuthenticated={handleAuthenticated}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">TWÓJ PLAN</p>
            <h1>Plan zajęć</h1>
          </div>
          <div className="page-heading-actions">
            <p className="timezone-note">Europe/Warsaw</p>
            <button
              className="primary-button add-event-button"
              type="button"
              onClick={() =>
                setFormSession({
                  mode: 'create',
                  initialDate: activeDate,
                })
              }
            >
              <span aria-hidden="true">+</span>
              Dodaj zajęcia
            </button>
          </div>
        </div>

        <div className="data-toolbar" aria-label="Dane kalendarza">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            Rok akademicki
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleExportJson}
          >
            Eksport JSON
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => backupInputRef.current?.click()}
          >
            Import JSON
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={handleExportIcs}
          >
            Eksport ICS
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setScheduleImportOpen(true)}
          >
            Import z Excela
          </button>
          <input
            ref={backupInputRef}
            accept="application/json,.json"
            className="visually-hidden"
            onChange={handleImportJson}
            type="file"
          />
        </div>

        {notice && (
          <div className="app-notice" role="status">
            <span>{notice}</span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setNotice(null)}
            >
              OK
            </button>
          </div>
        )}
        {storageError && (
          <div className="storage-alert" role="alert">
            <span>{repositoryErrorMessages[storageError]}</span>
            {storageError === 'invalid-data' && (
              <button
                className="secondary-button"
                type="button"
                onClick={handleRestoreDemo}
              >
                Wczytaj plan demonstracyjny
              </button>
            )}
          </div>
        )}

        <div className="calendar-layout">
          <section className="calendar-panel" aria-label="Kalendarz zajęć">
            <FullCalendar
              ref={calendarRef}
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                interactionPlugin,
                rrulePlugin,
              ]}
              initialView="dayGridMonth"
              initialDate={activeDate}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridDay',
              }}
              buttonText={{
                today: 'Dziś',
                month: 'Miesiąc',
                day: 'Dzień',
              }}
              locale={plLocale}
              timeZone="Europe/Warsaw"
              firstDay={1}
              events={(fetchInfo: EventSourceFuncArg, successCallback) => {
                successCallback([
                  ...toAnnotationEvents(semester),
                  ...toCalendarEvents(
                    eventSeries,
                    {
                      startDate: fetchInfo.startStr.slice(0, 10),
                      endDate: fetchInfo.endStr.slice(0, 10),
                    },
                    semester,
                  ),
                ]);
              }}
              dateClick={handleDateClick}
              navLinks
              navLinkDayClick={(date) =>
                // With a named time zone and no zone plugin FullCalendar passes
                // UTC-coerced dates, so the UTC date is the Warsaw calendar day.
                handleDateClick({ dateStr: date.toISOString().slice(0, 10) })
              }
              eventInteractive
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              scrollTime="08:00:00"
              slotDuration="01:00:00"
              slotEventOverlap={false}
              allDaySlot
              allDayText="cały dzień"
              height="auto"
              dayMaxEvents={3}
              nowIndicator
            />
          </section>

          <aside className="details-panel" aria-live="polite">
            <div className="details-heading">
              <p className="eyebrow">INFORMACJE</p>
              <h2>Szczegóły</h2>
            </div>
            {selectedEvent ? (
              <div className="event-details">
                <span
                  className="event-type"
                  style={
                    {
                      '--event-color': selectedEvent.color,
                    } as CSSProperties
                  }
                >
                  {classTypeLabels[selectedEvent.classType]}
                </span>
                <h3>{selectedEvent.title}</h3>
                <dl>
                  <div>
                    <dt>Data</dt>
                    <dd>{selectedEvent.date}</dd>
                  </div>
                  <div>
                    <dt>Godziny</dt>
                    <dd>
                      {selectedEvent.startTime}–{selectedEvent.endTime}
                    </dd>
                  </div>
                  <div>
                    <dt>Sala</dt>
                    <dd>{selectedEvent.room}</dd>
                  </div>
                  <div>
                    <dt>Budynek</dt>
                    <dd>{selectedEvent.building}</dd>
                  </div>
                </dl>
                <div className="details-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={openEditForm}
                  >
                    Edytuj
                  </button>
                </div>
              </div>
            ) : selectedAnnotation ? (
              <div className="event-details">
                <span className="event-type">
                  {periodKindLabels[selectedAnnotation.kind]}
                </span>
                <h3>{selectedAnnotation.label}</h3>
                <dl>
                  <div>
                    <dt>
                      {selectedAnnotation.startDate ===
                      selectedAnnotation.endDate
                        ? 'Data'
                        : 'Okres'}
                    </dt>
                    <dd>
                      {selectedAnnotation.startDate ===
                      selectedAnnotation.endDate
                        ? selectedAnnotation.startDate
                        : `${selectedAnnotation.startDate} – ${selectedAnnotation.endDate}`}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="details-empty">Wybierz zajęcia w kalendarzu</p>
            )}
          </aside>
        </div>
      </main>
      {formSession && (
        <EventForm
          key={
            formSession.mode === 'edit'
              ? `${formSession.seriesId}-${formSession.occurrenceDate}`
              : 'new-event'
          }
          mode={formSession.mode}
          initialDate={
            formSession.mode === 'edit'
              ? formSession.occurrenceDate
              : formSession.initialDate
          }
          semesterEndDate={semesterEndDate}
          semester={semester}
          series={eventSeries}
          initialEvent={
            formSession.mode === 'edit' ? formSession.initialEvent : undefined
          }
          occurrenceEvent={
            formSession.mode === 'edit'
              ? formSession.occurrenceEvent
              : undefined
          }
          occurrenceDate={
            formSession.mode === 'edit'
              ? formSession.occurrenceDate
              : formSession.initialDate
          }
          seriesId={
            formSession.mode === 'edit' ? formSession.seriesId : undefined
          }
          onCancel={() => setFormSession(null)}
          onSave={handleFormSave}
          onDelete={handleFormDelete}
          saveError={
            storageError ? repositoryErrorMessages[storageError] : undefined
          }
        />
      )}
      {settingsOpen && (
        <AcademicYearSettings
          semester={semester}
          today={todayInWarsaw()}
          saveError={
            storageError ? repositoryErrorMessages[storageError] : undefined
          }
          onCancel={() => setSettingsOpen(false)}
          onSave={(academicYear) => void handleAcademicYearSave(academicYear)}
        />
      )}
      {scheduleImportOpen && (
        <ScheduleImport
          semester={semester}
          existingSeries={eventSeries}
          colorFor={importColor}
          saveError={
            storageError ? repositoryErrorMessages[storageError] : undefined
          }
          onCancel={() => setScheduleImportOpen(false)}
          onImport={(result) => void handleScheduleImport(result)}
          onOpenAcademicYear={() => {
            setScheduleImportOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}
      {pendingImport && (
        <div className="modal-backdrop">
          <DialogKeyboard onClose={() => setPendingImport(null)} />
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
                Zaimportowany plan i semestr zastąpią obecne dane zapisane w tej
                przeglądarce.
              </p>
              {storageError && (
                <p className="form-errors" role="alert">
                  {repositoryErrorMessages[storageError]}
                </p>
              )}
              <footer className="form-actions">
                <span className="form-action-spacer" />
                <button
                  autoFocus
                  className="secondary-button"
                  type="button"
                  onClick={() => setPendingImport(null)}
                >
                  Anuluj
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={confirmImport}
                >
                  Importuj plan
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
