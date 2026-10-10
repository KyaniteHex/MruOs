import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventMountArg,
  EventSourceFuncArg,
} from '@fullcalendar/core';
import plLocale from '@fullcalendar/core/locales/pl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useLocation } from 'react-router';
import {
  EventSchema,
  classBlockColors,
  classKey,
  classesOn,
  expandOccurrences,
  placeEntries,
  planHours,
  todayInWarsaw,
  upcomingAssessments,
} from '@mruos/shared';
import type {
  Assessment,
  AssessmentKind,
  ClassBlockColors,
  DatedClass,
  Entry,
  EntryRecord,
  Event,
  Note,
  UpcomingAssessment,
} from '@mruos/shared';
import { semesterWeeksToDateRange } from '@mruos/shared/semester';
import { AppHeader } from './AppHeader';
import { AssessmentDetails } from './AssessmentDetails';
import { AssessmentForm } from './AssessmentForm';
import { BottomSheet } from './BottomSheet';
import { ClassEntries } from './ClassEntries';
import type { NewEntryKind } from './ClassEntries';
import { EventForm } from './EventForm';
import { MenuButton } from './MenuButton';
import { NoteForm } from './NoteForm';
import { PlanStatusScreen } from './PlanStatusScreen';
import { UpcomingBar, UpcomingList, UpcomingPanel } from './UpcomingPanel';
import { periodKindLabels } from './academicYearForm';
import {
  calendarTitle,
  isWeekend,
  startingDate,
  visibleDates,
  weekLabel,
  weekendHasItems,
} from './calendarDates';
import type { CalendarView } from './calendarDates';
import type {
  AnnotationDetails,
  AssessmentEventDetails,
  CalendarEventDetails,
  ClassMarks,
} from './calendarEvents';
import {
  classMarks,
  demoEventSeries,
  demoRange,
  demoSemester,
  hasAnnotations,
  toAnnotationEvents,
  toAssessmentEvents,
  toCalendarEvents,
} from './calendarEvents';
import { assessmentKindMarks, noteMark } from './entryFormModel';
import type { EntryContext } from './entryFormModel';
import { classTypeLabels } from './eventFormModel';
import type { EventEditScope } from './eventFormModel';
import { repositoryErrorMessages, usePlan } from './planContext';
import {
  narrowScreenQuery,
  phoneScreenQuery,
  useMediaQuery,
} from './useMediaQuery';

/** Where the calendar opens, e.g. on the first week of an imported plan. */
export type CalendarLocationState = { date?: string };

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

type CalendarState = {
  view: CalendarView;
  /** Every day of FullCalendar's range, hidden weekends included. */
  dates: string[];
  /** The first day of the month, week or day. */
  start: string;
};

/** The days on screen: phones may hide the weekend in the week view. */
function shownDates(state: CalendarState, showWeekends: boolean): string[] {
  return state.view === 'timeGridWeek' && !showWeekends
    ? state.dates.filter((date) => !isWeekend(date))
    : state.dates;
}

const views: { view: CalendarView; label: string }[] = [
  { view: 'timeGridWeek', label: 'Tydzień' },
  { view: 'dayGridMonth', label: 'Miesiąc' },
  { view: 'timeGridDay', label: 'Dzień' },
];

function minutes(time: string): number {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function hourTime(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00:00`;
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

function ClassMarkList({ marks }: { marks: ClassMarks }) {
  return (
    <>
      {marks.exam && (
        <EntryMark mark={assessmentKindMarks.exam} label="Egzamin" />
      )}
      {marks.test && (
        <EntryMark mark={assessmentKindMarks.test} label="Kolokwium" />
      )}
      {marks.note && <EntryMark mark={noteMark} label="Notatka" />}
    </>
  );
}

/** The class colours for the stylesheet, which picks them by theme. */
function blockStyle(color: string, colors: ClassBlockColors): CSSProperties {
  return {
    '--event-color': color,
    '--event-tint-light': colors.tintLight,
    '--event-tint-dark': colors.tintDark,
    '--event-stripe-light': colors.stripeLight,
    '--event-stripe-dark': colors.stripeDark,
    '--event-on-color': colors.onColor,
  } as CSSProperties;
}

function renderEventContent(info: EventContentArg) {
  const isMonth = info.view.type === 'dayGridMonth';

  if (isAssessmentEvent(info.event.extendedProps)) {
    const { kind, room } = info.event.extendedProps as AssessmentEventDetails;
    const title = (
      <strong className="calendar-event-subject">
        <span className="entry-mark-inline" aria-hidden="true">
          {assessmentKindMarks[kind]}
        </span>
        {info.event.title}
      </strong>
    );

    return isMonth ? (
      <div className="calendar-event-copy calendar-event-line">
        <span className="calendar-event-time">{info.timeText}</span>
        {title}
      </div>
    ) : (
      <div className="calendar-event-copy">
        {title}
        <span className="calendar-event-meta">
          {info.timeText}
          {room ? ` · s. ${room}` : ''}
        </span>
      </div>
    );
  }

  if (isAnnotation(info.event.extendedProps)) {
    const { kind, label } = info.event.extendedProps as AnnotationDetails;
    // Only the name: the colour already marks a day off.
    const prefix =
      kind === 'day-off' && label !== 'Dzień wolny' ? 'Dzień wolny: ' : '';

    return (
      <div className="calendar-annotation-copy" title={info.event.title}>
        {prefix && <span className="visually-hidden">{prefix}</span>}
        {label}
      </div>
    );
  }

  const details = info.event.extendedProps as CalendarEventDetails;
  const length = minutes(details.endTime) - minutes(details.startTime);
  const style = blockStyle(details.color, details.colors);
  const subject = (
    <strong className="calendar-event-subject">
      <ClassMarkList marks={details.marks} />
      {info.event.title}
    </strong>
  );

  // Months and short classes get one line: the start and the name.
  if (isMonth || length < 45) {
    return (
      <div className="calendar-event-copy calendar-event-line" style={style}>
        <span className="calendar-event-time">{details.startTime}</span>
        {subject}
      </div>
    );
  }

  return (
    <div className="calendar-event-copy" style={style}>
      {subject}
      <span className="calendar-event-meta">
        {details.startTime}–{details.endTime}
      </span>
      {length >= 60 && (
        <span className="calendar-event-meta">
          {classTypeLabels[details.classType]} · s. {details.room}
          {info.view.type === 'timeGridDay' ? ` · ${details.building}` : ''}
        </span>
      )}
    </div>
  );
}

/** The calendar, shown once the plan is there. */
export function App() {
  const plan = usePlan();

  return plan.status === 'ready' ? <CalendarPage /> : <PlanStatusScreen />;
}

function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const location = useLocation();
  const plan = usePlan();
  const { eventSeries, semester, entries, storageError } = plan;
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
  const [formSession, setFormSession] = useState<FormSession | null>(null);
  // Narrow screens show details and "Nadchodzące" in a sheet.
  const isNarrow = useMediaQuery(narrowScreenQuery);
  const isPhone = useMediaQuery(phoneScreenQuery);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [initialDate] = useState(
    () =>
      (location.state as CalendarLocationState | null)?.date ??
      startingDate(semester, todayInWarsaw()),
  );
  // The day new classes and entries start from.
  const [activeDate, setActiveDate] = useState(initialDate);
  const [calendarState, setCalendarState] = useState<CalendarState | null>(
    null,
  );
  // The block filled with its colour; kept when the calendar redraws.
  const selectedEventIdRef = useRef<string | null>(null);
  const semesterEndDate = semesterWeeksToDateRange(semester, 1, 20).endDate;
  const placed = useMemo(
    () => placeEntries(entries, eventSeries, semester),
    [entries, eventSeries, semester],
  );
  const hours = useMemo(
    () => planHours(eventSeries, entries),
    [eventSeries, entries],
  );
  const upcoming = upcomingAssessments(placed.assessments, todayInWarsaw());
  const showWeekends = showsWeekend(calendarState);
  const shown = calendarState ? shownDates(calendarState, showWeekends) : [];
  const firstShown = shown[0] ?? '';
  const lastShown = shown.at(-1) ?? firstShown;
  const title = calendarState
    ? calendarTitle(
        calendarState.view,
        calendarState.view === 'dayGridMonth'
          ? calendarState.start
          : firstShown,
        lastShown,
      )
    : '';
  // "tydzień 2 semestru"; none in the month view and outside teaching.
  const week =
    calendarState && calendarState.view !== 'dayGridMonth'
      ? weekLabel(semester, shown)
      : null;
  const selectedAssessment = placed.assessments.find(
    (scheduled) => scheduled.id === selectedAssessmentId && !scheduled.seriesId,
  );
  // The all-day row holds only days off, breaks and events.
  const showAllDayRow =
    shown.length > 0 && hasAnnotations(semester, firstShown, lastShown);

  useEffect(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [eventSeries, semester, placed]);

  function calendarApi() {
    return calendarRef.current?.getApi();
  }

  function markSelected(id: string | null, element?: HTMLElement) {
    selectedEventIdRef.current = id;
    document
      .querySelectorAll('.fc-event.is-selected')
      .forEach((node) => node.classList.remove('is-selected'));
    element?.classList.add('is-selected');
  }

  function handleEventMount(arg: EventMountArg) {
    if (arg.event.id === selectedEventIdRef.current) {
      arg.el.classList.add('is-selected');
    }
  }

  /** Phones show Monday–Friday unless that week has weekend classes. */
  function showsWeekend(state: CalendarState | null): boolean {
    return (
      !isPhone ||
      (state?.view === 'timeGridWeek' &&
        weekendHasItems(eventSeries, placed.assessments, semester, state.start))
    );
  }

  function handleDatesSet(arg: DatesSetArg) {
    const view = arg.view.type as CalendarView;
    const state: CalendarState = {
      view,
      dates: visibleDates(arg.startStr.slice(0, 10), arg.endStr.slice(0, 10)),
      // With a named time zone FullCalendar passes UTC-coerced dates, so the
      // UTC date is the Warsaw calendar day.
      start: arg.view.currentStart.toISOString().slice(0, 10),
    };
    const days = shownDates(state, showsWeekend(state));
    const today = todayInWarsaw();

    setCalendarState(state);
    setActiveDate(
      days.includes(today)
        ? today
        : view === 'dayGridMonth'
          ? state.start
          : (days[0] ?? state.start),
    );
  }

  function clearSelection() {
    setSelectedEvent(null);
    setSelectedAnnotation(null);
    setSelectedAssessmentId(null);
    markSelected(null);
  }

  function handleDateClick(info: { dateStr: string }) {
    setActiveDate(info.dateStr);
    clearSelection();
    calendarApi()?.changeView('timeGridDay', info.dateStr);
  }

  function handleEventClick(info: EventClickArg) {
    setSelectedEvent(null);
    setSelectedAnnotation(null);
    setSelectedAssessmentId(null);

    if (isAssessmentEvent(info.event.extendedProps)) {
      const { assessmentId } = info.event
        .extendedProps as AssessmentEventDetails;
      markSelected(info.event.id, info.el);
      setSelectedAssessmentId(assessmentId);
      return;
    }
    if (isAnnotation(info.event.extendedProps)) {
      // Narrow month cells cut long names; the panel shows them in full.
      markSelected(null);
      setSelectedAnnotation(info.event.extendedProps as AnnotationDetails);
      return;
    }
    const details = info.event.extendedProps as CalendarEventDetails;

    markSelected(info.event.id, info.el);
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
          ? (selectedEvent?.date ?? activeDate)
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
    // A new kolokwium or exam may be in another week, e.g. in the session.
    if (!id && entry.anchor.type !== 'subject') {
      calendarApi()?.gotoDate(entry.anchor.date);
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
      markSelected(null);
    }
    setEntrySession(null);
  }

  function openUpcoming(item: UpcomingAssessment) {
    setActiveDate(item.date);
    setUpcomingOpen(false);
    setSelectedAnnotation(null);
    calendarApi()?.changeView('timeGridDay', item.date);

    const dated = item.seriesId
      ? classesOn(eventSeries, item.date, semester).find(
          (candidate) => candidate.seriesId === item.seriesId,
        )
      : undefined;
    if (!dated) {
      markSelected(`entry-${item.id}`);
      setSelectedEvent(null);
      setSelectedAssessmentId(item.id);
      return;
    }

    // A kolokwium during a class is shown with the class.
    markSelected(`${dated.seriesId}-${dated.date}`);
    setSelectedAssessmentId(null);
    setSelectedEvent({
      building: dated.event.building,
      classType: dated.event.classType,
      color: dated.event.color,
      colors: classBlockColors(dated.event.color),
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
    markSelected(null);
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
    markSelected(null);
  }

  async function handleRestoreDemo() {
    if (await persistSnapshot(demoEventSeries, demoSemester, [])) {
      setActiveDate(demoRange.startDate);
      calendarApi()?.gotoDate(demoRange.startDate);
    }
  }

  const controls = (
    <div className="calendar-controls">
      <div className="segmented" role="group" aria-label="Widok kalendarza">
        {views.map(({ view, label }) => (
          <button
            aria-pressed={calendarState?.view === view}
            key={view}
            type="button"
            onClick={() => calendarApi()?.changeView(view)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="calendar-nav">
        <button
          aria-label="Poprzedni"
          className="secondary-button nav-button"
          title="Poprzedni"
          type="button"
          onClick={() => calendarApi()?.prev()}
        >
          ‹
        </button>
        <button
          aria-label="Następny"
          className="secondary-button nav-button"
          title="Następny"
          type="button"
          onClick={() => calendarApi()?.next()}
        >
          ›
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => calendarApi()?.today()}
        >
          Dziś
        </button>
      </div>
    </div>
  );

  const addMenu = (
    <MenuButton
      align="end"
      className="primary-button add-button"
      items={[
        {
          label: 'Zajęcia',
          // A weekly class covers the whole semester unless changed.
          onSelect: () =>
            setFormSession({ mode: 'create', initialDate: semester.startDate }),
        },
        {
          label: 'Kolokwium lub egzamin',
          onSelect: () => addEntry('test', { date: activeDate }),
        },
      ]}
    >
      + Dodaj
    </MenuButton>
  );

  const details = selectedEvent ? (
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
        subjectNotes={placed.subjectNotes.get(selectedEvent.title) ?? []}
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
            {selectedAnnotation.startDate === selectedAnnotation.endDate
              ? 'Data'
              : 'Okres'}
          </dt>
          <dd>
            {selectedAnnotation.startDate === selectedAnnotation.endDate
              ? selectedAnnotation.startDate
              : `${selectedAnnotation.startDate} – ${selectedAnnotation.endDate}`}
          </dd>
        </div>
      </dl>
    </div>
  ) : null;

  return (
    <div className="app-shell">
      <AppHeader actions={addMenu} />

      <main className="workspace calendar-workspace">
        {storageError && (
          <div className="storage-alert" role="alert">
            <span>{repositoryErrorMessages[storageError]}</span>
            {storageError === 'invalid-data' && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => void handleRestoreDemo()}
              >
                Wczytaj plan demonstracyjny
              </button>
            )}
          </div>
        )}

        <div className="calendar-layout">
          {isNarrow ? (
            <UpcomingBar
              upcoming={upcoming}
              orphans={placed.orphans}
              onOpen={() => setUpcomingOpen(true)}
            />
          ) : (
            <UpcomingPanel
              upcoming={upcoming}
              orphans={placed.orphans}
              onOpenAssessment={openUpcoming}
              onOpenOrphan={editEntry}
            />
          )}
          <section className="calendar-panel" aria-labelledby="calendar-title">
            <div className="calendar-heading">
              <div className="calendar-heading-text">
                <h1 className="calendar-title" id="calendar-title">
                  {title}
                </h1>
                {week && <p className="calendar-week">{week}</p>}
              </div>
              {controls}
            </div>
            <div className="calendar-body">
              <FullCalendar
                ref={calendarRef}
                plugins={[
                  dayGridPlugin,
                  timeGridPlugin,
                  interactionPlugin,
                  rrulePlugin,
                ]}
                initialView="timeGridWeek"
                initialDate={initialDate}
                headerToolbar={false}
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
                views={{ timeGridWeek: { weekends: showWeekends } }}
                datesSet={handleDatesSet}
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
                eventDidMount={handleEventMount}
                eventDisplay="block"
                eventTimeFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }}
                slotMinTime={hourTime(hours.start)}
                slotMaxTime={hourTime(hours.end)}
                scrollTime={hourTime(hours.start)}
                slotDuration="01:00:00"
                slotEventOverlap={false}
                allDaySlot={showAllDayRow}
                allDayText="cały dzień"
                // Breaks and events stay in the top row, single days below.
                eventOrder="row,start,-duration,allDay,title"
                // The calendar fills the screen; hours stretch to fit it.
                height="100%"
                expandRows
                dayMaxEvents={3}
                nowIndicator
              />
            </div>
          </section>

          {!isNarrow && (
            <aside className="details-panel" aria-live="polite">
              <div className="details-heading">
                <p className="eyebrow">INFORMACJE</p>
                <h2>Szczegóły</h2>
              </div>
              {details ?? (
                <p className="details-empty">Wybierz zajęcia w kalendarzu</p>
              )}
            </aside>
          )}
        </div>
      </main>
      {isNarrow && details ? (
        <BottomSheet
          eyebrow="INFORMACJE"
          title="Szczegóły"
          active={!formSession && !entrySession}
          onClose={clearSelection}
        >
          {details}
        </BottomSheet>
      ) : isNarrow && upcomingOpen ? (
        <BottomSheet
          eyebrow="NAJBLIŻSZE 14 DNI"
          title="Nadchodzące"
          active={!formSession && !entrySession}
          onClose={() => setUpcomingOpen(false)}
        >
          <UpcomingList
            upcoming={upcoming}
            orphans={placed.orphans}
            onOpenAssessment={openUpcoming}
            onOpenOrphan={editEntry}
          />
        </BottomSheet>
      ) : null}
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
    </div>
  );
}
