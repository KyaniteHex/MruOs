import { useState } from 'react';
import type { FormEvent } from 'react';
import type { IcsOptions } from './calendarIcs';
import { useDialogKeyboard } from './useDialogKeyboard';

type IcsExportDialogProps = {
  onCancel: () => void;
  onExport: (options: IcsOptions) => void;
};

export function IcsExportDialog({ onCancel, onExport }: IcsExportDialogProps) {
  useDialogKeyboard(onCancel);
  const [options, setOptions] = useState<IcsOptions>({
    assessments: true,
    notes: true,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onExport(options);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal ics-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ics-export-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">EKSPORT</p>
            <h2 id="ics-export-title">Eksport do kalendarza</h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>
        <form className="event-form" onSubmit={handleSubmit}>
          <fieldset className="form-section">
            <legend>Oprócz zajęć dołącz</legend>
            <label className="interval-option">
              <input
                autoFocus
                checked={options.assessments}
                onChange={(event) =>
                  setOptions({ ...options, assessments: event.target.checked })
                }
                type="checkbox"
              />
              <span>Kolokwia i egzaminy, z przypomnieniami</span>
            </label>
            <label className="interval-option">
              <input
                checked={options.notes}
                onChange={(event) =>
                  setOptions({ ...options, notes: event.target.checked })
                }
                type="checkbox"
              />
              <span>Notatki, w opisach zajęć</span>
            </label>
          </fieldset>
          <p className="field-hint">
            Plik .ics zaimportujesz w Kalendarzu Google, Apple lub Outlooku.
            Niektóre kalendarze pomijają przypomnienia z plików.
          </p>
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
              Pobierz plik .ics
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
