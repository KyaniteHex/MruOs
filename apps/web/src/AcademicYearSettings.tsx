import { useState } from 'react';
import type { FormEvent } from 'react';
import { weekdayPlanNames } from '@mruos/shared';
import type {
  AcademicPeriodKind,
  AcademicYear,
  Semester,
  Weekday,
} from '@mruos/shared';
import {
  changeAcademicYear,
  createAcademicYearDraft,
  draftToAcademicYear,
  periodKindLabels,
  restoreHolidays,
  rowKey,
  termLabels,
} from './academicYearForm';
import type {
  AcademicYearDraft,
  DayOffRow,
  DayPlanRow,
  PeriodRow,
  SemesterDraft,
} from './academicYearForm';
import { useDialogKeyboard } from './useDialogKeyboard';

type AcademicYearSettingsProps = {
  semester: Semester;
  today: string;
  saveError?: string;
  onCancel: () => void;
  onSave: (academicYear: AcademicYear) => void;
};

const periodKinds = Object.keys(periodKindLabels) as AcademicPeriodKind[];
const weekdays = Object.keys(weekdayPlanNames) as Weekday[];

export function AcademicYearSettings({
  semester,
  today,
  saveError,
  onCancel,
  onSave,
}: AcademicYearSettingsProps) {
  useDialogKeyboard(onCancel);
  const [draft, setDraft] = useState<AcademicYearDraft>(() =>
    createAcademicYearDraft(semester, today),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const years = [
    ...new Set([
      draft.startYear,
      ...[-1, 0, 1, 2].map((offset) => Number(today.slice(0, 4)) + offset),
    ]),
  ].sort();

  function updateSemester(index: number, change: Partial<SemesterDraft>) {
    setDraft((current) => ({
      ...current,
      semesters: current.semesters.map((semesterDraft, position) =>
        position === index ? { ...semesterDraft, ...change } : semesterDraft,
      ),
    }));
  }

  function updateRow(
    semesterIndex: number,
    key: string,
    change: Partial<PeriodRow>,
  ) {
    setDraft((current) => ({
      ...current,
      semesters: current.semesters.map((semesterDraft, position) =>
        position === semesterIndex
          ? {
              ...semesterDraft,
              rows: semesterDraft.rows.map((row) =>
                row.key === key ? { ...row, ...change } : row,
              ),
            }
          : semesterDraft,
      ),
    }));
  }

  function updateDayOff(key: string, change: Partial<DayOffRow>) {
    setDraft((current) => ({
      ...current,
      daysOff: current.daysOff.map((row) =>
        row.key === key ? { ...row, ...change } : row,
      ),
    }));
  }

  function updateDayPlan(key: string, change: Partial<DayPlanRow>) {
    setDraft((current) => ({
      ...current,
      dayPlans: current.dayPlans.map((row) =>
        row.key === key ? { ...row, ...change } : row,
      ),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = draftToAcademicYear(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    onSave(result.academicYear);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal academic-year-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academic-year-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">USTAWIENIA</p>
            <h2 id="academic-year-title">Rok akademicki</h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>

        <form
          className="event-form academic-year"
          noValidate
          onSubmit={handleSubmit}
        >
          <label className="form-field academic-year-select">
            <span>Rok akademicki</span>
            <select
              autoFocus
              onChange={(event) =>
                setDraft((current) =>
                  changeAcademicYear(current, Number(event.target.value)),
                )
              }
              value={draft.startYear}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}/{year + 1}
                </option>
              ))}
            </select>
          </label>

          {draft.semesters.map((semesterDraft, semesterIndex) => {
            const name = termLabels[semesterDraft.term];

            return (
              <fieldset className="form-section" key={semesterDraft.term}>
                <legend>{name}</legend>
                <div className="form-grid">
                  <label className="form-field">
                    <span>{name}: od</span>
                    <input
                      onChange={(event) =>
                        updateSemester(semesterIndex, {
                          startDate: event.target.value,
                        })
                      }
                      type="date"
                      value={semesterDraft.startDate}
                    />
                  </label>
                  <label className="form-field">
                    <span>{name}: do</span>
                    <input
                      onChange={(event) =>
                        updateSemester(semesterIndex, {
                          endDate: event.target.value,
                        })
                      }
                      type="date"
                      value={semesterDraft.endDate}
                    />
                  </label>
                </div>

                <ul className="academic-rows">
                  {semesterDraft.rows.map((row, rowIndex) => {
                    const rowName =
                      row.label.trim() || `pozycja ${rowIndex + 1}`;

                    return (
                      <li className="academic-row" key={row.key}>
                        <input
                          aria-label={`Nazwa pozycji ${rowIndex + 1}, ${name.toLowerCase()}`}
                          onChange={(event) =>
                            updateRow(semesterIndex, row.key, {
                              label: event.target.value,
                            })
                          }
                          value={row.label}
                        />
                        <select
                          aria-label={`Rodzaj: ${rowName}`}
                          onChange={(event) =>
                            updateRow(semesterIndex, row.key, {
                              kind: event.target.value as AcademicPeriodKind,
                            })
                          }
                          value={row.kind}
                        >
                          {periodKinds.map((kind) => (
                            <option key={kind} value={kind}>
                              {periodKindLabels[kind]}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`Od: ${rowName}`}
                          onChange={(event) =>
                            updateRow(semesterIndex, row.key, {
                              startDate: event.target.value,
                            })
                          }
                          type="date"
                          value={row.startDate}
                        />
                        <input
                          aria-label={`Do: ${rowName}`}
                          onChange={(event) =>
                            updateRow(semesterIndex, row.key, {
                              endDate: event.target.value,
                            })
                          }
                          type="date"
                          value={row.endDate}
                        />
                        <button
                          aria-label={`Usuń pozycję: ${rowName}`}
                          className="remove-day-off"
                          type="button"
                          onClick={() =>
                            updateSemester(semesterIndex, {
                              rows: semesterDraft.rows.filter(
                                (candidate) => candidate.key !== row.key,
                              ),
                            })
                          }
                        >
                          Usuń
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    updateSemester(semesterIndex, {
                      rows: [
                        ...semesterDraft.rows,
                        {
                          key: rowKey(),
                          label: '',
                          kind: 'event',
                          startDate: '',
                          endDate: '',
                        },
                      ],
                    })
                  }
                >
                  Dodaj pozycję: {name.toLowerCase()}
                </button>
              </fieldset>
            );
          })}

          <fieldset className="form-section">
            <legend>Dni wolne od zajęć</legend>
            <p className="field-hint">
              Święta ustawowe są wpisane automatycznie. Zajęcia w te dni są
              odwołane.
            </p>
            <ul className="academic-rows">
              {draft.daysOff.map((row, index) => {
                const rowName = row.label.trim() || `dzień ${index + 1}`;

                return (
                  <li className="academic-row academic-day-off" key={row.key}>
                    <input
                      aria-label={`Data: ${rowName}`}
                      onChange={(event) =>
                        updateDayOff(row.key, { date: event.target.value })
                      }
                      type="date"
                      value={row.date}
                    />
                    <input
                      aria-label={`Opis dnia wolnego ${index + 1}`}
                      onChange={(event) =>
                        updateDayOff(row.key, { label: event.target.value })
                      }
                      value={row.label}
                    />
                    <button
                      aria-label={`Usuń dzień wolny: ${rowName}`}
                      className="remove-day-off"
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          daysOff: current.daysOff.filter(
                            (candidate) => candidate.key !== row.key,
                          ),
                        }))
                      }
                    >
                      Usuń
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="academic-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    daysOff: [
                      ...current.daysOff,
                      { key: rowKey(), date: '', label: '' },
                    ],
                  }))
                }
              >
                Dodaj dzień wolny
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDraft(restoreHolidays)}
              >
                Przywróć święta ustawowe
              </button>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Zamiany dni</legend>
            <p className="field-hint">
              Dni, w które zajęcia odbywają się według planu innego dnia, np.
              28.01 według planu poniedziałkowego. Zajęcia z danego dnia
              tygodnia wtedy nie odbywają się.
            </p>
            {draft.dayPlans.length > 0 && (
              <ul className="academic-rows">
                {draft.dayPlans.map((row, index) => (
                  <li className="academic-row academic-day-off" key={row.key}>
                    <input
                      aria-label={`Data zamiany ${index + 1}`}
                      onChange={(event) =>
                        updateDayPlan(row.key, { date: event.target.value })
                      }
                      type="date"
                      value={row.date}
                    />
                    <select
                      aria-label={`Według planu, zamiana ${index + 1}`}
                      onChange={(event) =>
                        updateDayPlan(row.key, {
                          weekday: event.target.value as Weekday,
                        })
                      }
                      value={row.weekday}
                    >
                      {weekdays.map((weekday) => (
                        <option key={weekday} value={weekday}>
                          według planu {weekdayPlanNames[weekday]}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label={`Usuń zamianę ${index + 1}`}
                      className="remove-day-off"
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          dayPlans: current.dayPlans.filter(
                            (candidate) => candidate.key !== row.key,
                          ),
                        }))
                      }
                    >
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="academic-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    dayPlans: [
                      ...current.dayPlans,
                      { key: rowKey(), date: '', weekday: 'MO' },
                    ],
                  }))
                }
              >
                Dodaj zamianę dnia
              </button>
            </div>
          </fieldset>

          {(errors.length > 0 || saveError) && (
            <ul className="form-errors" role="alert">
              {saveError && <li>{saveError}</li>}
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
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
              Zapisz harmonogram
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
