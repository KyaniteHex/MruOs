import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Event, Semester, Weekday } from '@mruos/shared';
import type { EventSeries } from './calendarEvents';
import {
  buildEventFromDraft,
  classTypeLabels,
  classTypes,
  createEventFormDraft,
  defaultClassColors,
} from './eventFormModel';
import type { EventEditScope, EventFormDraft } from './eventFormModel';
import { findScheduleConflicts } from './scheduleConflicts';

type EventFormProps = {
  mode: 'create' | 'edit';
  initialDate: string;
  semesterEndDate: string;
  semester: Semester;
  series: readonly EventSeries[];
  initialEvent?: Event;
  occurrenceEvent?: Event;
  occurrenceDate: string;
  seriesId?: string;
  onCancel: () => void;
  onSave: (event: Event, scope: EventEditScope) => void;
  onDelete?: (scope: EventEditScope) => void;
  saveError?: string;
};

const weekdays: { value: Weekday; label: string }[] = [
  { value: 'MO', label: 'Pon' },
  { value: 'TU', label: 'Wt' },
  { value: 'WE', label: 'Śr' },
  { value: 'TH', label: 'Czw' },
  { value: 'FR', label: 'Pt' },
  { value: 'SA', label: 'Sob' },
  { value: 'SU', label: 'Niedz' },
];

export function EventForm({
  mode,
  initialDate,
  semesterEndDate,
  semester,
  series,
  initialEvent,
  occurrenceEvent,
  occurrenceDate,
  seriesId,
  onCancel,
  onSave,
  onDelete,
  saveError,
}: EventFormProps) {
  const [scope, setScope] = useState<EventEditScope>(
    mode === 'edit' ? 'occurrence' : 'series',
  );
  const [draft, setDraft] = useState<EventFormDraft>(() =>
    createEventFormDraft(
      mode === 'edit' ? (occurrenceEvent ?? initialEvent) : undefined,
      initialDate,
      semesterEndDate,
    ),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const result = buildEventFromDraft(
    draft,
    initialEvent,
    scope,
    occurrenceDate,
    semester,
  );
  const conflicts = result.success
    ? findScheduleConflicts(
        result.event,
        series,
        result.range,
        semester,
        seriesId,
      )
    : [];

  function updateDraft<Key extends keyof EventFormDraft>(
    key: Key,
    value: EventFormDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  }

  function changeScope(nextScope: EventEditScope) {
    setScope(nextScope);
    setDraft(
      createEventFormDraft(
        nextScope === 'occurrence'
          ? (occurrenceEvent ?? initialEvent)
          : initialEvent,
        initialDate,
        semesterEndDate,
      ),
    );
    setErrors([]);
  }

  function toggleWeekday(weekday: Weekday) {
    const byDay = draft.byDay.includes(weekday)
      ? draft.byDay.filter((day) => day !== weekday)
      : [...draft.byDay, weekday];

    updateDraft('byDay', byDay);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = buildEventFromDraft(
      draft,
      initialEvent,
      scope,
      occurrenceDate,
      semester,
    );

    if (!submitted.success) {
      setErrors(submitted.errors);
      return;
    }

    onSave(submitted.event, scope);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">
              {mode === 'create' ? 'NOWY WPIS' : 'ZMIANA WPISU'}
            </p>
            <h2 id="event-form-title">
              {mode === 'create' ? 'Dodaj zajęcia' : 'Edytuj zajęcia'}
            </h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>

        <form className="event-form" noValidate onSubmit={handleSubmit}>
          {mode === 'edit' && (
            <fieldset className="form-scope">
              <legend>Zakres zmiany</legend>
              <label>
                <input
                  checked={scope === 'occurrence'}
                  name="edit-scope"
                  onChange={() => changeScope('occurrence')}
                  type="radio"
                />
                Tylko ten termin
              </label>
              <label>
                <input
                  checked={scope === 'series'}
                  name="edit-scope"
                  onChange={() => changeScope('series')}
                  type="radio"
                />
                Cała seria
              </label>
            </fieldset>
          )}

          <div className="form-grid">
            <label className="form-field form-field-wide">
              <span>Przedmiot</span>
              <input
                autoFocus
                onChange={(event) => updateDraft('subject', event.target.value)}
                value={draft.subject}
              />
            </label>

            <label className="form-field">
              <span>Typ zajęć</span>
              <select
                onChange={(event) => {
                  const classType = event.target
                    .value as EventFormDraft['classType'];
                  setDraft((current) => ({
                    ...current,
                    classType,
                    color: defaultClassColors[classType],
                  }));
                  setErrors([]);
                }}
                value={draft.classType}
              >
                {classTypes.map((classType) => (
                  <option key={classType} value={classType}>
                    {classTypeLabels[classType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field form-color-field">
              <span>Kolor</span>
              <input
                aria-label="Kolor zajęć"
                onChange={(event) => updateDraft('color', event.target.value)}
                type="color"
                value={draft.color}
              />
            </label>

            <label className="form-field">
              <span>Budynek</span>
              <input
                onChange={(event) =>
                  updateDraft('building', event.target.value)
                }
                value={draft.building}
              />
            </label>

            <label className="form-field">
              <span>Sala</span>
              <input
                onChange={(event) => updateDraft('room', event.target.value)}
                value={draft.room}
              />
            </label>

            <label className="form-field">
              <span>Od</span>
              <input
                onChange={(event) =>
                  updateDraft('startTime', event.target.value)
                }
                type="time"
                value={draft.startTime}
              />
            </label>

            <label className="form-field">
              <span>Do</span>
              <input
                onChange={(event) => updateDraft('endTime', event.target.value)}
                type="time"
                value={draft.endTime}
              />
            </label>
          </div>

          {scope === 'series' && (
            <>
              <fieldset className="form-section">
                <legend>Dni tygodnia</legend>
                <div className="weekday-options">
                  {weekdays.map((weekday) => (
                    <label
                      className={
                        draft.byDay.includes(weekday.value) ? 'is-selected' : ''
                      }
                      key={weekday.value}
                    >
                      <input
                        checked={draft.byDay.includes(weekday.value)}
                        onChange={() => toggleWeekday(weekday.value)}
                        type="checkbox"
                      />
                      {weekday.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="interval-option">
                <input
                  checked={draft.interval === 2}
                  onChange={(event) =>
                    updateDraft('interval', event.target.checked ? 2 : 1)
                  }
                  type="checkbox"
                />
                <span>Co dwa tygodnie</span>
              </label>

              <fieldset className="form-section">
                <legend>Zakres obowiązywania</legend>
                <div className="range-options">
                  <label
                    className={draft.rangeMode === 'dates' ? 'is-selected' : ''}
                  >
                    <input
                      checked={draft.rangeMode === 'dates'}
                      name="range-mode"
                      onChange={() => updateDraft('rangeMode', 'dates')}
                      type="radio"
                    />
                    Daty
                  </label>
                  <label
                    className={draft.rangeMode === 'weeks' ? 'is-selected' : ''}
                  >
                    <input
                      checked={draft.rangeMode === 'weeks'}
                      name="range-mode"
                      onChange={() => updateDraft('rangeMode', 'weeks')}
                      type="radio"
                    />
                    Tygodnie semestru
                  </label>
                </div>
                {draft.rangeMode === 'dates' ? (
                  <div className="form-grid form-range-grid">
                    <label className="form-field">
                      <span>Od dnia</span>
                      <input
                        onChange={(event) =>
                          updateDraft('startDate', event.target.value)
                        }
                        type="date"
                        value={draft.startDate}
                      />
                    </label>
                    <label className="form-field">
                      <span>Do dnia</span>
                      <input
                        onChange={(event) =>
                          updateDraft('endDate', event.target.value)
                        }
                        type="date"
                        value={draft.endDate}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="form-grid form-range-grid">
                    <label className="form-field">
                      <span>Od tygodnia</span>
                      <input
                        min="1"
                        onChange={(event) =>
                          updateDraft('firstWeek', event.target.value)
                        }
                        step="1"
                        type="number"
                        value={draft.firstWeek}
                      />
                    </label>
                    <label className="form-field">
                      <span>Do tygodnia</span>
                      <input
                        min="1"
                        onChange={(event) =>
                          updateDraft('lastWeek', event.target.value)
                        }
                        step="1"
                        type="number"
                        value={draft.lastWeek}
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            </>
          )}

          {(errors.length > 0 || saveError) && (
            <ul className="form-errors" role="alert">
              {saveError && <li>{saveError}</li>}
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          {conflicts.length > 0 && (
            <div className="collision-warning" role="status">
              <strong>Możliwa kolizja z innymi zajęciami</strong>
              <ul>
                {conflicts.slice(0, 3).map((conflict) => (
                  <li key={`${conflict.seriesId}-${conflict.date}`}>
                    {conflict.subject}, {conflict.date}, {conflict.startTime}–
                    {conflict.endTime}
                  </li>
                ))}
              </ul>
              {conflicts.length > 3 && (
                <span>i {conflicts.length - 3} kolejnych terminów</span>
              )}
            </div>
          )}

          {confirmingDelete ? (
            <div className="delete-confirmation" role="alertdialog">
              <p>
                Usunąć{' '}
                {scope === 'occurrence' ? 'tylko ten termin' : 'całą serię'}?
              </p>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Anuluj
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => onDelete?.(scope)}
              >
                Potwierdź usunięcie
              </button>
            </div>
          ) : (
            <footer className="form-actions">
              {mode === 'edit' && (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Usuń
                </button>
              )}
              <span className="form-action-spacer" />
              <button
                className="secondary-button"
                type="button"
                onClick={onCancel}
              >
                Anuluj
              </button>
              <button className="primary-button" type="submit">
                {mode === 'create' ? 'Dodaj zajęcia' : 'Zapisz zmiany'}
              </button>
            </footer>
          )}
        </form>
      </section>
    </div>
  );
}
