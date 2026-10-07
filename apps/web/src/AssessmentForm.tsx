import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { classAnchor, classesOn, planSubjects } from '@mruos/shared';
import type {
  Assessment,
  AssessmentKind,
  EventSeries,
  Reminder,
  Semester,
} from '@mruos/shared';
import {
  assessmentKindLabels,
  buildAssessment,
  changeAssessmentKind,
  changeAssessmentSubject,
  chosenClass,
  classSlotLabel,
  classSlotValue,
  createAssessmentDraft,
  effectivePlacement,
  reminderLabels,
  reminders,
} from './entryFormModel';
import type { AssessmentDraft, EntryContext } from './entryFormModel';
import { useDialogKeyboard } from './useDialogKeyboard';

type AssessmentFormProps = {
  mode: 'create' | 'edit';
  kind: AssessmentKind;
  context: EntryContext;
  initial?: Assessment;
  series: readonly EventSeries[];
  semester: Pick<Semester, 'daysOff'>;
  onCancel: () => void;
  onSave: (assessment: Assessment) => void;
  onDelete?: () => void;
  saveError?: string;
};

const assessmentKinds: AssessmentKind[] = ['test', 'exam'];
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function AssessmentForm({
  mode,
  kind,
  context,
  initial,
  series,
  semester,
  onCancel,
  onSave,
  onDelete,
  saveError,
}: AssessmentFormProps) {
  useDialogKeyboard(onCancel);
  const [draft, setDraft] = useState<AssessmentDraft>(() =>
    createAssessmentDraft(kind, context, series, initial),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const subjects = useMemo(() => planSubjects(series), [series]);
  const options = useMemo(
    () =>
      isDate(draft.date)
        ? classesOn(series, draft.date, semester).filter(
            (dated) => dated.event.subject === draft.subject.trim(),
          )
        : [],
    [series, semester, draft.date, draft.subject],
  );
  const placement = effectivePlacement(draft.placement, options);
  const selectedClass = chosenClass(draft.classSlot, options);

  function update<Key extends keyof AssessmentDraft>(
    key: Key,
    value: AssessmentDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  }

  function toggleReminder(reminder: Reminder) {
    update(
      'reminders',
      draft.reminders.includes(reminder)
        ? draft.reminders.filter((current) => current !== reminder)
        : reminders.filter(
            (candidate) =>
              candidate === reminder || draft.reminders.includes(candidate),
          ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildAssessment(draft, options);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    onSave(result.value);
  }

  const title =
    mode === 'create'
      ? 'Dodaj kolokwium lub egzamin'
      : 'Edytuj kolokwium lub egzamin';

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-form-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">
              {mode === 'create' ? 'NOWY WPIS' : 'ZMIANA WPISU'}
            </p>
            <h2 id="assessment-form-title">{title}</h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>

        <form
          className="event-form entry-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <fieldset className="form-section">
            <legend>Rodzaj</legend>
            <div className="range-options">
              {assessmentKinds.map((option) => (
                <label
                  className={draft.kind === option ? 'is-selected' : ''}
                  key={option}
                >
                  <input
                    checked={draft.kind === option}
                    name="assessment-kind"
                    onChange={() => {
                      setDraft((current) =>
                        changeAssessmentKind(current, option),
                      );
                      setErrors([]);
                    }}
                    type="radio"
                  />
                  {assessmentKindLabels[option]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-grid">
            <label className="form-field form-field-wide">
              <span>Tytuł</span>
              <input
                autoFocus
                maxLength={120}
                onChange={(event) => update('title', event.target.value)}
                value={draft.title}
              />
            </label>
            <label className="form-field form-field-wide">
              <span>Przedmiot</span>
              <input
                list="assessment-subjects"
                onChange={(event) => {
                  const subject = event.target.value;
                  setDraft((current) =>
                    changeAssessmentSubject(current, subject, series),
                  );
                  setErrors([]);
                }}
                value={draft.subject}
              />
              <datalist id="assessment-subjects">
                {subjects.map((subject) => (
                  <option key={subject} value={subject} />
                ))}
              </datalist>
            </label>
            <label className="form-field">
              <span>Data</span>
              <input
                onChange={(event) => update('date', event.target.value)}
                type="date"
                value={draft.date}
              />
            </label>
          </div>

          <fieldset className="form-section">
            <legend>Kiedy</legend>
            <div className="range-options">
              <label className={placement === 'class' ? 'is-selected' : ''}>
                <input
                  checked={placement === 'class'}
                  disabled={options.length === 0}
                  name="assessment-placement"
                  onChange={() => update('placement', 'class')}
                  type="radio"
                />
                W czasie zajęć
              </label>
              <label className={placement === 'own' ? 'is-selected' : ''}>
                <input
                  checked={placement === 'own'}
                  name="assessment-placement"
                  onChange={() => update('placement', 'own')}
                  type="radio"
                />
                Osobny termin
              </label>
            </div>
            {options.length === 0 && (
              <p className="field-hint">
                Tego dnia nie ma zajęć z tego przedmiotu.
              </p>
            )}
            {placement === 'class' && selectedClass && (
              <label className="form-field entry-class-field">
                <span>Zajęcia</span>
                <select
                  onChange={(event) => update('classSlot', event.target.value)}
                  value={classSlotValue(classAnchor(selectedClass))}
                >
                  {options.map((dated) => (
                    <option
                      key={dated.seriesId}
                      value={classSlotValue(classAnchor(dated))}
                    >
                      {classSlotLabel(dated)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {placement === 'own' && (
              <div className="form-grid form-range-grid">
                <label className="form-field">
                  <span>Od</span>
                  <input
                    onChange={(event) =>
                      update('startTime', event.target.value)
                    }
                    type="time"
                    value={draft.startTime}
                  />
                </label>
                <label className="form-field">
                  <span>Do</span>
                  <input
                    onChange={(event) => update('endTime', event.target.value)}
                    type="time"
                    value={draft.endTime}
                  />
                </label>
                <label className="form-field">
                  <span>Budynek</span>
                  <input
                    maxLength={120}
                    onChange={(event) => update('building', event.target.value)}
                    value={draft.building}
                  />
                </label>
                <label className="form-field">
                  <span>Sala</span>
                  <input
                    maxLength={60}
                    onChange={(event) => update('room', event.target.value)}
                    value={draft.room}
                  />
                </label>
              </div>
            )}
          </fieldset>

          <label className="form-field">
            <span>Zakres lub opis (opcjonalnie)</span>
            <textarea
              maxLength={2000}
              onChange={(event) => update('details', event.target.value)}
              rows={3}
              value={draft.details}
            />
          </label>

          <fieldset className="form-section">
            <legend>Przypomnienie w kalendarzu</legend>
            <div className="reminder-options">
              {reminders.map((reminder) => (
                <label className="interval-option" key={reminder}>
                  <input
                    checked={draft.reminders.includes(reminder)}
                    onChange={() => toggleReminder(reminder)}
                    type="checkbox"
                  />
                  <span>{reminderLabels[reminder]}</span>
                </label>
              ))}
            </div>
            <p className="field-hint">
              Przypomnienia trafiają do eksportu .ics.
            </p>
          </fieldset>

          {(errors.length > 0 || saveError) && (
            <ul className="form-errors" role="alert">
              {saveError && <li>{saveError}</li>}
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          {confirmingDelete ? (
            <div className="delete-confirmation" role="alertdialog">
              <p>Usunąć ten wpis?</p>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Anuluj
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={onDelete}
              >
                Potwierdź usunięcie
              </button>
            </div>
          ) : (
            <footer className="form-actions">
              {mode === 'edit' && onDelete && (
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
                {mode === 'create' ? 'Zapisz' : 'Zapisz zmiany'}
              </button>
            </footer>
          )}
        </form>
      </section>
    </div>
  );
}
