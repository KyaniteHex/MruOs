import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';
import plLocale from '@fullcalendar/core/locales/pl';
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CalendarEventDetails } from './calendarEvents';
import { demoCalendarEvents } from './calendarEvents';

type SelectedEvent = CalendarEventDetails & {
  title: string;
  date: string;
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

  function handleDateClick(info: { dateStr: string }) {
    setSelectedEvent(null);
    calendarRef.current?.getApi().changeView('timeGridDay', info.dateStr);
  }

  function handleEventClick(info: EventClickArg) {
    const details = info.event.extendedProps as CalendarEventDetails;

    setSelectedEvent({
      ...details,
      title: info.event.title,
      date: info.event.startStr.slice(0, 10),
    });
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
          <p className="timezone-note">Europe/Warsaw</p>
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
              events={demoCalendarEvents}
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
              </div>
            ) : (
              <p className="details-empty">Wybierz zajęcia w kalendarzu</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
