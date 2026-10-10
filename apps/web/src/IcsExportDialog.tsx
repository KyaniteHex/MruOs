import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CalendarFeedOptions } from '@mruos/shared';
import { useDialogKeyboard } from './useDialogKeyboard';

type IcsExportDialogProps = {
  /** Signed in: shows the way to a subscription instead. */
  onShowSubscription?: () => void;
  onCancel: () => void;
  onExport: (options: CalendarFeedOptions) => void;
};

const optionLabels: Record<keyof CalendarFeedOptions, string> = {
  assessments: 'Kolokwia i egzaminy, z przypomnieniami',
  notes: 'Notatki, w opisach zajęć',
  daysOff: 'Dni wolne od zajęć',
  periods: 'Przerwy i sesja',
};

export function IcsExportDialog({
  onShowSubscription,
  onCancel,
  onExport,
}: IcsExportDialogProps) {
  useDialogKeyboard(onCancel);
  const [options, setOptions] = useState<CalendarFeedOptions>({
    assessments: true,
    notes: true,
    daysOff: false,
    periods: false,
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
            {(Object.keys(optionLabels) as (keyof CalendarFeedOptions)[]).map(
              (option, index) => (
                <label className="interval-option" key={option}>
                  <input
                    autoFocus={index === 0}
                    checked={options[option]}
                    onChange={(event) =>
                      setOptions({ ...options, [option]: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>{optionLabels[option]}</span>
                </label>
              ),
            )}
          </fieldset>
          <p className="field-hint">
            Plik .ics to jednorazowa kopia planu dla Kalendarza Google, Apple
            lub Outlooka; późniejsze zmiany do niej nie trafią.{' '}
            {onShowSubscription ? (
              <>
                Kalendarz, który aktualizuje się sam:{' '}
                <button
                  className="text-button inline-button"
                  type="button"
                  onClick={onShowSubscription}
                >
                  Kalendarz w telefonie
                </button>
                .
              </>
            ) : (
              'Kalendarz, który aktualizuje się sam, wymaga konta.'
            )}
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
