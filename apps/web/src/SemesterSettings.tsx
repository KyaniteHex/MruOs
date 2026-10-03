import { useState } from 'react';
import type { FormEvent } from 'react';
import { SemesterSchema, datesBetween } from '@mruos/shared';
import type { Semester } from '@mruos/shared';
import { useDialogKeyboard } from './useDialogKeyboard';

type SemesterSettingsProps = {
  semester: Semester;
  saveError?: string;
  onCancel: () => void;
  onSave: (semester: Semester) => void;
};

export function SemesterSettings({
  semester,
  saveError,
  onCancel,
  onSave,
}: SemesterSettingsProps) {
  useDialogKeyboard(onCancel);
  const [startDate, setStartDate] = useState(semester.startDate);
  const [daysOff, setDaysOff] = useState(semester.daysOff);
  const [newDayOff, setNewDayOff] = useState('');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addDayOff() {
    if (!newDayOff || daysOff.includes(newDayOff)) {
      return;
    }

    setDaysOff((current) => [...current, newDayOff].sort());
    setNewDayOff('');
    setError(null);
  }

  function addBreak() {
    const dates = datesBetween(breakStart, breakEnd);

    if (dates.length === 0) {
      setError('Podaj poprawny zakres przerwy (najwyżej 120 dni).');
      return;
    }

    setDaysOff((current) => [...new Set([...current, ...dates])].sort());
    setBreakStart('');
    setBreakEnd('');
    setError(null);
  }

  function removeDayOff(date: string) {
    setDaysOff((current) => current.filter((dayOff) => dayOff !== date));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = SemesterSchema.safeParse({ startDate, daysOff });

    if (!result.success) {
      setError('Sprawdź datę rozpoczęcia i listę dni wolnych.');
      return;
    }

    onSave(result.data);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal semester-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="semester-settings-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">USTAWIENIA</p>
            <h2 id="semester-settings-title">Semestr</h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>

        <form className="event-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Pierwszy dzień semestru</span>
            <input
              autoFocus
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </label>

          <fieldset className="semester-days-off">
            <legend>Dni wolne</legend>
            <div className="day-off-entry">
              <label className="form-field">
                <span>Dodaj dzień wolny</span>
                <input
                  onChange={(event) => setNewDayOff(event.target.value)}
                  type="date"
                  value={newDayOff}
                />
              </label>
              <button
                className="secondary-button"
                disabled={!newDayOff || daysOff.includes(newDayOff)}
                type="button"
                onClick={addDayOff}
              >
                Dodaj dzień
              </button>
            </div>
            <div className="day-off-entry">
              <label className="form-field">
                <span>Przerwa od</span>
                <input
                  onChange={(event) => setBreakStart(event.target.value)}
                  type="date"
                  value={breakStart}
                />
              </label>
              <label className="form-field">
                <span>Przerwa do</span>
                <input
                  onChange={(event) => setBreakEnd(event.target.value)}
                  type="date"
                  value={breakEnd}
                />
              </label>
              <button
                className="secondary-button"
                disabled={!breakStart || !breakEnd}
                type="button"
                onClick={addBreak}
              >
                Dodaj przerwę
              </button>
            </div>
            <p className="field-hint">
              Tygodnie, w których wszystkie dni robocze są wolne, nie są liczone
              jako tygodnie semestru.
            </p>

            {daysOff.length > 0 ? (
              <ul className="days-off-list">
                {daysOff.map((date) => (
                  <li key={date}>
                    <time dateTime={date}>{date}</time>
                    <button
                      aria-label={`Usuń dzień wolny ${date}`}
                      className="remove-day-off"
                      type="button"
                      onClick={() => removeDayOff(date)}
                    >
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="details-empty">Brak dni wolnych</p>
            )}
          </fieldset>

          {(error || saveError) && (
            <p className="form-errors" role="alert">
              {saveError ?? error}
            </p>
          )}

          <footer className="form-actions">
            <span className="form-action-spacer" />
            <button
              className="secondary-button"
              type="button"
              onClick={onCancel}
            >
              Anuluj
            </button>
            <button className="primary-button" type="submit">
              Zapisz ustawienia
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
