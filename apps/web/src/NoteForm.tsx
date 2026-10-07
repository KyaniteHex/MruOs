import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { classAnchor, classesOn, planSubjects } from '@mruos/shared';
import type { EventSeries, Note, Semester } from '@mruos/shared';
import {
  buildNote,
  chosenClass,
  classSlotLabel,
  classSlotValue,
  createNoteDraft,
} from './entryFormModel';
import type { EntryContext, NoteDraft } from './entryFormModel';
import { useDialogKeyboard } from './useDialogKeyboard';

type NoteFormProps = {
  mode: 'create' | 'edit';
  context: EntryContext;
  initial?: Note;
  series: readonly EventSeries[];
  semester: Pick<Semester, 'daysOff'>;
  onCancel: () => void;
  onSave: (note: Note) => void;
  onDelete?: () => void;
  saveError?: string;
};

const maxNoteLength = 2000;
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function NoteForm({
  mode,
  context,
  initial,
  series,
  semester,
  onCancel,
  onSave,
  onDelete,
  saveError,
}: NoteFormProps) {
  useDialogKeyboard(onCancel);
  const [draft, setDraft] = useState<NoteDraft>(() =>
    createNoteDraft(context, initial),
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
  const selectedClass = chosenClass(draft.classSlot, options);

  function update<Key extends keyof NoteDraft>(
    key: Key,
    value: NoteDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildNote(draft, options);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    onSave(result.value);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-form-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">
              {mode === 'create' ? 'NOWA NOTATKA' : 'ZMIANA NOTATKI'}
            </p>
            <h2 id="note-form-title">
              {mode === 'create' ? 'Dodaj notatkę' : 'Edytuj notatkę'}
            </h2>
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
          <div className="form-grid">
            <label className="form-field form-field-wide">
              <span>Przedmiot</span>
              <input
                list="note-subjects"
                onChange={(event) => update('subject', event.target.value)}
                value={draft.subject}
              />
              <datalist id="note-subjects">
                {subjects.map((subject) => (
                  <option key={subject} value={subject} />
                ))}
              </datalist>
            </label>
          </div>

          <fieldset className="form-section">
            <legend>Dotyczy</legend>
            <div className="range-options">
              <label className={draft.target === 'class' ? 'is-selected' : ''}>
                <input
                  checked={draft.target === 'class'}
                  name="note-target"
                  onChange={() => update('target', 'class')}
                  type="radio"
                />
                Terminu zajęć
              </label>
              <label
                className={draft.target === 'subject' ? 'is-selected' : ''}
              >
                <input
                  checked={draft.target === 'subject'}
                  name="note-target"
                  onChange={() => update('target', 'subject')}
                  type="radio"
                />
                Całego przedmiotu
              </label>
            </div>
            {draft.target === 'class' && (
              <div className="form-grid form-range-grid">
                <label className="form-field">
                  <span>Data</span>
                  <input
                    onChange={(event) => update('date', event.target.value)}
                    type="date"
                    value={draft.date}
                  />
                </label>
                {selectedClass ? (
                  <label className="form-field">
                    <span>Zajęcia</span>
                    <select
                      onChange={(event) =>
                        update('classSlot', event.target.value)
                      }
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
                ) : (
                  <p className="field-hint">
                    Tego dnia nie ma zajęć z tego przedmiotu.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <label className="form-field">
            <span>Treść</span>
            <textarea
              autoFocus
              maxLength={maxNoteLength}
              onChange={(event) => update('text', event.target.value)}
              rows={5}
              value={draft.text}
            />
            <span className="field-hint">
              {draft.text.length}/{maxNoteLength} znaków
            </span>
          </label>

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
              <p>Usunąć tę notatkę?</p>
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
                {mode === 'create' ? 'Zapisz notatkę' : 'Zapisz zmiany'}
              </button>
            </footer>
          )}
        </form>
      </section>
    </div>
  );
}
