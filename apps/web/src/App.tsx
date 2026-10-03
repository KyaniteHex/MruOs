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
import type { CSSProperties } from 'react';
import { EventSchema, expandOccurrences } from '@mruos/shared';
import type { Event } from '@mruos/shared';
import { EventForm } from './EventForm';
import type { EventEditScope } from './eventFormModel';
import type { CalendarEventDetails, EventSeries } from './calendarEvents';
import {
    demoEventSeries,
    demoRange,
    demoSemester,
    toCalendarEvents,
} from './calendarEvents';

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

function renderEventContent(info: EventContentArg) {
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

export function App() {
    const calendarRef = useRef<FullCalendar>(null);
    const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(
        null,
    );
    const [eventSeries, setEventSeries] =
        useState<EventSeries[]>(demoEventSeries);
    const [formSession, setFormSession] = useState<FormSession | null>(null);
    const [activeDate, setActiveDate] = useState(demoRange.startDate);

    useEffect(() => {
        calendarRef.current?.getApi().refetchEvents();
    }, [eventSeries]);

    function handleDateClick(info: { dateStr: string }) {
        setActiveDate(info.dateStr);
        setSelectedEvent(null);
        calendarRef.current?.getApi().changeView('timeGridDay', info.dateStr);
    }

    function handleEventClick(info: EventClickArg) {
        const details = info.event.extendedProps as CalendarEventDetails;

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
                demoSemester,
            )[0]?.event ?? series.event;

        setFormSession({
            mode: 'edit',
            initialEvent: series.event,
            occurrenceEvent,
            occurrenceDate: selectedEvent.date,
            seriesId: series.id,
        });
    }

    function handleFormSave(event: Event, scope: EventEditScope) {
        if (!formSession) {
            return;
        }

        if (formSession.mode === 'create') {
            setEventSeries((current) => [
                ...current,
                { id: crypto.randomUUID(), event },
            ]);
        } else {
            setEventSeries((current) =>
                current.map((series) => {
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
                }),
            );
        }

        setFormSession(null);
        setSelectedEvent(null);
    }

    function handleFormDelete(scope: EventEditScope) {
        if (formSession?.mode !== 'edit') {
            return;
        }

        if (scope === 'series') {
            setEventSeries((current) =>
                current.filter((series) => series.id !== formSession.seriesId),
            );
        } else {
            setEventSeries((current) =>
                current.map((series) => {
                    if (series.id !== formSession.seriesId) {
                        return series;
                    }

                    const exceptions = [
                        ...series.event.exceptions.filter(
                            (exception) => exception.date !== formSession.occurrenceDate,
                        ),
                        { date: formSession.occurrenceDate, status: 'cancelled' as const },
                    ];

                    return {
                        ...series,
                        event: EventSchema.parse({ ...series.event, exceptions }),
                    };
                }),
            );
        }

        setFormSession(null);
        setSelectedEvent(null);
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
                    <span className="term-dot" aria-hidden="true" />
                    Semestr zimowy <span className="term-year">2026/27</span>
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
                                setFormSession({ mode: 'create', initialDate: activeDate })
                            }
                        >
                            <span aria-hidden="true">+</span>
                            Dodaj zajęcia
                        </button>
                    </div>
                </div>

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
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridMonth,timeGridDay',
                            }}
                            buttonText={{ today: 'Dziś', month: 'Miesiąc', day: 'Dzień' }}
                            locale={plLocale}
                            timeZone="Europe/Warsaw"
                            firstDay={1}
                            events={(fetchInfo: EventSourceFuncArg, successCallback) => {
                                successCallback(
                                    toCalendarEvents(
                                        eventSeries,
                                        {
                                            startDate: fetchInfo.startStr.slice(0, 10),
                                            endDate: fetchInfo.endStr.slice(0, 10),
                                        },
                                        demoSemester,
                                    ),
                                );
                            }}
                            dateClick={handleDateClick}
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
                            allDaySlot={false}
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
                                        { '--event-color': selectedEvent.color } as CSSProperties
                                    }
                                >
                                    {selectedEvent.classType}
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
                    semesterEndDate={demoRange.endDate}
                    semester={demoSemester}
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
                />
            )}
        </div>
    );
}
