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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import {
  EventSchema,
  classKey,
  classesOn,
  expandOccurrences,
  placeEntries,
  semesterFromAcademicYear,
  todayInWarsaw,
  upcomingAssessments,
} from '@mruos/shared';
import type {
  AcademicYear,
  Assessment,
  CalendarFeedOptions,
  AssessmentKind,
  DatedClass,
  Entry,
  EntryRecord,
  Note,
  UpcomingAssessment,
} from '@mruos/shared';
import type { ClassType, Event } from '@mruos/shared';
import { semesterWeeksToDateRange } from '@mruos/shared/semester';
import { Link, useNavigate } from 'react-router';
import { useAuth } from './authContext';
import { slowServerMessage, useSlowHint } from './useSlowHint';
import { EventForm } from './EventForm';
import { AssessmentDetails } from './AssessmentDetails';
import { AssessmentForm } from './AssessmentForm';
import { ClassEntries } from './ClassEntries';
import type { NewEntryKind } from './ClassEntries';
import { IcsExportDialog } from './IcsExportDialog';
import { NoteForm } from './NoteForm';
import { UpcomingPanel } from './UpcomingPanel';
import { assessmentKindMarks, noteMark } from './entryFormModel';
import type { EntryContext } from './entryFormModel';
import { AcademicYearSettings } from './AcademicYearSettings';
import { periodKindLabels } from './academicYearForm';
import { DialogKeyboard } from './useDialogKeyboard';
import { ScheduleImport } from './ScheduleImport';
import type { ScheduleImportResult } from './ScheduleImport';
import { classTypeLabels, defaultClassColors } from './eventFormModel';
import type { EventEditScope } from './eventFormModel';
import type {
  AnnotationDetails,
  AssessmentEventDetails,
  CalendarEventDetails,
} from './calendarEvents';
import {
  classMarks,
  demoEventSeries,
  demoRange,
  demoSemester,
  toAnnotationEvents,
  toAssessmentEvents,
  toCalendarEvents,
} from './calendarEvents';
import { exportCalendarBackup, importCalendarBackup } from './calendarBackup';
import { downloadFile } from './fileDownload';
import type { CalendarSnapshot } from './eventRepository';
import { repositoryErrorMessages, usePlan } from './planContext';

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

type EntrySession =
  | {
      form: 'assessment';
      kind: AssessmentKind;
      context: EntryContext;
      id?: string;
      initial?: Assessment;
    }
  | { form: 'note'; context: EntryContext; id?: string; initial?: Note };

function importColor(classType: ClassType): string {
  return defaultClassColors[classType];
}

function isAnnotation(props: Record<string, unknown>): boolean {
  return (props as Partial<AnnotationDetails>).annotation === true;
}

function isAssessmentEvent(props: Record<string, unknown>): boolean {
  return (
    typeof (props as Partial<AssessmentEventDetails>).assessmentId === 'string'
  );
}

function EntryMark({ mark, label }: { mark: string; label: string }) {
  return (
    <>
      <span className="entry-mark-inline" aria-hidden="true">
        {mark}
      </span>
      <span className="visually-hidden">{label}: </span>
    </>
  );
}

function renderEventContent(info: EventContentArg) {
  if (isAssessmentEvent(info.event.extendedProps)) {
    const { kind, room } = info.event.extendedProps as AssessmentEventDetails;

    return (
      <div className="calendar-event-copy">
        <div className="calendar-event-primary">
          <span>{info.timeText}</span>
          <strong>
            <span className="entry-mark-inline" aria-hidden="true">
              {assessmentKindMarks[kind]}
            </span>
            {info.event.title}
          </strong>
        </div>
        {room && <span className="calendar-event-location">{room}</span>}
      </div>
    );
  }

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
        <strong>
          {details.marks.exam && (
            <EntryMark mark={assessmentKindMarks.exam} label="Egzamin" />
          )}
          {details.marks.test && (
            <EntryMark mark={assessmentKindMarks.test} label="Kolokwium" />
          )}
          {details.marks.note && <EntryMark mark={noteMark} label="Notatka" />}
          {info.event.title}
        </strong>
      </div>
      <span className="calendar-event-location">
        {isDayView ? `${details.room} · ${details.building}` : details.room}
      </span>
    </div>
  );
}

export function App() {
  const calendarRef = useRef<FullCalendar>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const auth = useAuth();
  const navigate = useNavigate();
  const { user: authUser } = auth;
  const plan = usePlan();
  const { eventSeries, semester, entries, storageError, setStorageError } =
    plan;
  const accountPlan = plan.status;
  const persistSnapshot = plan.save;
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<AnnotationDetails | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(
    null,
  );
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null);
  const [entrySession, setEntrySession] = useState<EntrySession | null>(null);
  const [icsExportOpen, setIcsExportOpen] = useState(false);
  const [formSession, setFormSession] = useState<FormSession | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<CalendarSnapshot | null>(
    null,
  );
  // Set once the student moves around; until then the plan decides.
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const currentDate = activeDate ?? semester.startDate;
  const slowAccountPlan = useSlowHint(accountPlan === 'loading');
  const semesterEndDate = semesterWeeksToDateRange(semester, 1, 20).endDate;
  const placed = useMemo(
    () => placeEntries(entries, eventSeries, semester),
    [entries, eventSeries, semester],
  );
  const upcoming = upcomingAssessments(placed.assessments, todayInWarsaw());
  const selectedAssessment = placed.assessments.find(
    (scheduled) => scheduled.id === selectedAssessmentId && !scheduled.seriesId,
  );

  useEffect(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [eventSeries, semester, placed]);

  async function handleLogout() {
    await auth.api.logout();
    auth.signOut();
    navigate('/', { replace: true });
  }

  function handleDateClick(info: { dateStr: string }) {
    setActiveDate(info.dateStr);
    setSelectedEvent(null);
    setSelectedAnnotation(null);
    setSelectedAssessmentId(null);
    calendarRef.current?.getApi().changeView('timeGridDay', info.dateStr);
  }

  function handleEventClick(info: EventClickArg) {
    setSelectedEvent(null);
    setSelectedAnnotation(null);
    setSelectedAssessmentId(null);

    if (isAssessmentEvent(info.event.extendedProps)) {
      const { assessmentId } = info.event
        .extendedProps as AssessmentEventDetails;
      setSelectedAssessmentId(assessmentId);
      return;
    }
    if (isAnnotation(info.event.extendedProps)) {
      // Narrow month cells cut long names; the panel shows them in full.
      setSelectedAnnotation(info.event.extendedProps as AnnotationDetails);
      return;
    }
    const details = info.event.extendedProps as CalendarEventDetails;

    setSelectedEvent({
      ...details,
      title: info.event.title,
    });
  }

  function selectedClass(): DatedClass | undefined {
    if (!selectedEvent) {
      return undefined;
    }
    return classesOn(eventSeries, selectedEvent.date, semester).find(
      (dated) => dated.seriesId === selectedEvent.seriesId,
    );
  }

  function addEntry(kind: NewEntryKind, context: EntryContext) {
    setEntrySession(
      kind === 'note'
        ? { form: 'note', context }
        : { form: 'assessment', kind, context },
    );
  }

  function addEntryToSelectedClass(kind: NewEntryKind) {
    const dated = selectedClass();
    if (dated) {
      addEntry(kind, { date: dated.date, dated });
    }
  }

  function editEntry(record: EntryRecord) {
    const { entry } = record;
    const context: EntryContext = {
      date:
        entry.anchor.type === 'subject'
          ? (selectedEvent?.date ?? currentDate)
          : entry.anchor.date,
      subject: entry.subject,
    };

    setEntrySession(
      entry.kind === 'note'
        ? { form: 'note', context, id: record.id, initial: entry }
        : {
            form: 'assessment',
            kind: entry.kind,
            context,
            id: record.id,
            initial: entry,
          },
    );
  }

  async function saveEntry(entry: Entry) {
    if (!entrySession) {
      return;
    }

    const { id } = entrySession;
    const nextEntries = id
      ? entries.map((record) => (record.id === id ? { id, entry } : record))
      : [...entries, { id: crypto.randomUUID(), entry }];
    if (!(await persistSnapshot(eventSeries, semester, nextEntries))) {
      return;
    }

    setEntrySession(null);
    // A new kolokwium or exam may be in another month, e.g. in the session.
    if (!id && entry.anchor.type !== 'subject') {
      calendarRef.current?.getApi().gotoDate(entry.anchor.date);
    }
  }

  async function deleteEntry() {
    const id = entrySession?.id;
    if (!id) {
      return;
    }

    const nextEntries = entries.filter((record) => record.id !== id);
    if (!(await persistSnapshot(eventSeries, semester, nextEntries))) {
      return;
    }

    if (selectedAssessmentId === id) {
      setSelectedAssessmentId(null);
    }
    setEntrySession(null);
  }

  function openUpcoming(item: UpcomingAssessment) {
    setActiveDate(item.date);
    setSelectedAnnotation(null);
    calendarRef.current?.getApi().changeView('timeGridDay', item.date);

    const dated = item.seriesId
      ? classesOn(eventSeries, item.date, semester).find(
          (candidate) => candidate.seriesId === item.seriesId,
        )
      : undefined;
    if (!dated) {
      setSelectedEvent(null);
      setSelectedAssessmentId(item.id);
      return;
    }

    // A kolokwium during a class is shown with the class.
    setSelectedAssessmentId(null);
    setSelectedEvent({
      building: dated.event.building,
      classType: dated.event.classType,
      color: dated.event.color,
      date: dated.date,
      endTime: dated.event.endTime,
      marks: classMarks(
        placed.byClass.get(classKey(dated.seriesId, dated.date)),
      ),
      room: dated.event.room,
      seriesId: dated.seriesId,
      startTime: dated.event.startTime,
      title: dated.event.subject,
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
      exportCalendarBackup({ events: eventSeries, semester, entries }),
    );
  }

  async function handleExportIcs(options: CalendarFeedOptions) {
    // Loaded on demand: the iCalendar library is only needed here.
    const { calendarIcs } = await import('@mruos/shared/ics');

    downloadFile(
      'mruos-plan.ics',
      'text/calendar;charset=utf-8',
      calendarIcs({ events: eventSeries, semester, entries }, options),
    );
    setIcsExportOpen(false);
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
      !(await persistSnapshot(
        pendingImport.events,
        pendingImport.semester,
        pendingImport.entries,
      ))
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
    if (await persistSnapshot(demoEventSeries, demoSemester, [])) {
      setActiveDate(demoRange.startDate);
      calendarRef.current?.getApi().gotoDate(demoRange.startDate);
    }
  }

  const topbar = (
    <header className="topbar">
      <a className="brand" href="/" aria-label="MruOS, strona główna">
        <span className="brand-mark" aria-hidden="true">
          M
        </span>
        <span>MruOS</span>
      </a>
      <div className="topbar-term">
        {accountPlan === 'ready' && (
          <div className="term-label">
            <span className="term-dot" aria-hidden="true" />
            Semestr od <span className="term-year">{semester.startDate}</span>
          </div>
        )}
        {authUser ? (
          <div className="account-controls">
            <span className="account-email">{authUser.email}</span>
            <div className="account-actions">
              <Link className="secondary-button account-button" to="/konto">
                Konto
              </Link>
              <button
                className="secondary-button account-button"
                type="button"
                onClick={() => void handleLogout()}
              >
                Wyloguj
              </button>
            </div>
          </div>
        ) : (
          <div className="account-controls">
            <span className="account-mode">Tryb bez konta</span>
            <div className="account-actions">
              <Link className="secondary-button account-button" to="/">
                Zaloguj się
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );

  if (accountPlan !== 'ready') {
    return (
      <div className="app-shell">
        {topbar}
        <main className="workspace">
          {accountPlan === 'failed' ? (
            <div className="storage-alert" role="alert">
              <span>
                {storageError
                  ? repositoryErrorMessages[storageError]
                  : 'Nie udało się wczytać planu.'}
              </span>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void plan.retry()}
              >
                Spróbuj ponownie
              </button>
            </div>
          ) : (
            <p className="plan-loading" role="status">
              Wczytywanie planu…{slowAccountPlan && ` ${slowServerMessage}`}
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {topbar}

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
                  initialDate: currentDate,
                })
              }
            >
              <span aria-hidden="true">+</span>
              Dodaj zajęcia
            </button>
            <button
              className="secondary-button add-entry-button"
              type="button"
              onClick={() => addEntry('test', { date: currentDate })}
            >
              + Kolokwium / egzamin
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
            onClick={() => setIcsExportOpen(true)}
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
          <UpcomingPanel
            upcoming={upcoming}
            orphans={placed.orphans}
            onOpenAssessment={openUpcoming}
            onOpenOrphan={editEntry}
          />
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
              initialDate={currentDate}
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
                const range = {
                  startDate: fetchInfo.startStr.slice(0, 10),
                  endDate: fetchInfo.endStr.slice(0, 10),
                };
                successCallback([
                  ...toAnnotationEvents(semester),
                  ...toCalendarEvents(eventSeries, range, semester, placed),
                  ...toAssessmentEvents(placed.assessments, range),
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
                <ClassEntries
                  records={
                    placed.byClass.get(
                      classKey(selectedEvent.seriesId, selectedEvent.date),
                    ) ?? []
                  }
                  subjectNotes={
                    placed.subjectNotes.get(selectedEvent.title) ?? []
                  }
                  onAdd={addEntryToSelectedClass}
                  onEdit={editEntry}
                />
              </div>
            ) : selectedAssessment ? (
              <AssessmentDetails
                scheduled={selectedAssessment}
                onEdit={() => {
                  const record = entries.find(
                    (candidate) => candidate.id === selectedAssessment.id,
                  );
                  if (record) {
                    editEntry(record);
                  }
                }}
              />
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
      {entrySession?.form === 'assessment' && (
        <AssessmentForm
          mode={entrySession.id ? 'edit' : 'create'}
          kind={entrySession.kind}
          context={entrySession.context}
          initial={entrySession.initial}
          series={eventSeries}
          semester={semester}
          onCancel={() => setEntrySession(null)}
          onSave={(assessment) => void saveEntry(assessment)}
          onDelete={entrySession.id ? () => void deleteEntry() : undefined}
          saveError={
            storageError ? repositoryErrorMessages[storageError] : undefined
          }
        />
      )}
      {entrySession?.form === 'note' && (
        <NoteForm
          mode={entrySession.id ? 'edit' : 'create'}
          context={entrySession.context}
          initial={entrySession.initial}
          series={eventSeries}
          semester={semester}
          onCancel={() => setEntrySession(null)}
          onSave={(note) => void saveEntry(note)}
          onDelete={entrySession.id ? () => void deleteEntry() : undefined}
          saveError={
            storageError ? repositoryErrorMessages[storageError] : undefined
          }
        />
      )}
      {icsExportOpen && (
        <IcsExportDialog
          canSubscribe={Boolean(authUser)}
          onCancel={() => setIcsExportOpen(false)}
          onExport={(options) => void handleExportIcs(options)}
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
                Zaimportowany plan, semestr oraz kolokwia, egzaminy i notatki
                zastąpią obecne dane.
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
