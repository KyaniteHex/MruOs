import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  buildImportCandidates,
  defaultSelection,
  parseScheduleBlock,
  summarizeSubjects,
} from '@mruos/shared';
import type {
  ClassType,
  Event,
  ImportCandidate,
  ImportIssue,
  ImportSelection,
  Semester,
  SubjectChoice,
  Weekday,
} from '@mruos/shared';
import { classTypeLabels } from './eventFormModel';
import { useDialogKeyboard } from './useDialogKeyboard';
import { maxScheduleFileBytes, readScheduleWorkbook } from './xlsxSchedule';
import type { ScheduleReadError, ScheduleSheet } from './xlsxSchedule';

export type ScheduleImportResult = {
  events: Event[];
  semesterStartDate: string;
  replace: boolean;
};

type ScheduleImportProps = {
  semester: Semester;
  colorFor: (classType: ClassType) => string;
  saveError?: string;
  onCancel: () => void;
  onImport: (result: ScheduleImportResult) => void;
};

const readErrorMessages: Record<ScheduleReadError | 'read-failed', string> = {
  'xls-not-supported':
    'To plik w starym formacie .xls. Otwórz go w Excelu lub LibreOffice i zapisz jako .xlsx.',
  'not-xlsx':
    'Nie udało się odczytać pliku. Wybierz plan zajęć w formacie .xlsx.',
  'too-large': 'Plik jest za duży (limit 10 MB).',
  'no-schedule':
    'W pliku nie znaleziono bloków z zajęciami narysowanych na siatce planu.',
  'read-failed': 'Nie udało się wczytać pliku z dysku.',
};

const weekdayLabels: Record<Weekday, string> = {
  MO: 'Pon',
  TU: 'Wt',
  WE: 'Śr',
  TH: 'Czw',
  FR: 'Pt',
  SA: 'Sob',
  SU: 'Niedz',
};

function issueMessage(issue: ImportIssue): string {
  switch (issue.code) {
    case 'missing-subject':
      return 'Brak nazwy przedmiotu.';
    case 'missing-type':
      return 'Nie rozpoznano typu zajęć, przyjęto ćwiczenia.';
    case 'missing-weekday':
      return 'Nie rozpoznano dnia tygodnia.';
    case 'missing-time':
      return 'Brak godzin zajęć.';
    case 'missing-weeks':
      return 'Brak tygodni, w których odbywają się zajęcia.';
    case 'missing-room':
      return 'Plan nie podaje sali. Uzupełnij ją po imporcie.';
    case 'missing-building':
      return 'Plan nie podaje budynku. Uzupełnij go po imporcie.';
    case 'unparsed-text':
      return `Nierozpoznany tekst: „${issue.detail ?? ''}”.`;
    case 'invalid-event':
      return 'Niepoprawne dane zajęć (np. koniec przed początkiem).';
    case 'room-change-unmatched':
      return `Zmiana sali ${issue.detail ?? ''} nie pasuje do terminów zajęć.`;
  }
}

// FileReader works in every supported browser and in the jsdom test DOM.
function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error('Unexpected file reader result'));
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsArrayBuffer(file);
  });
}

/** "1–10, 12" style summary of sorted week numbers. */
function formatWeeks(weeks: readonly number[]): string {
  const ranges: [number, number][] = [];
  for (const week of weeks) {
    const last = ranges.at(-1);
    if (last && week === last[1] + 1) {
      last[1] = week;
    } else {
      ranges.push([week, week]);
    }
  }

  return ranges
    .map(([first, last]) => (first === last ? `${first}` : `${first}–${last}`))
    .join(', ');
}

export function ScheduleImport({
  semester,
  colorFor,
  saveError,
  onCancel,
  onImport,
}: ScheduleImportProps) {
  useDialogKeyboard(onCancel);
  const [sheets, setSheets] = useState<ScheduleSheet[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [startDate, setStartDate] = useState(semester.startDate);
  const [selection, setSelection] = useState<ImportSelection>({});
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [replace, setReplace] = useState(false);

  const sheet = sheets.find((candidate) => candidate.name === sheetName);
  const blocks = useMemo(
    () => sheet?.blocks.map((block) => parseScheduleBlock(block)) ?? [],
    [sheet],
  );
  const subjects = useMemo(
    () => summarizeSubjects(blocks, sheet?.knownSubjects),
    [blocks, sheet],
  );
  const candidates = useMemo(
    () =>
      /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? buildImportCandidates(blocks, {
            semester: { startDate, daysOff: semester.daysOff },
            selection,
            colorFor,
            knownSubjects: sheet?.knownSubjects,
          })
        : [],
    [blocks, startDate, semester.daysOff, selection, colorFor, sheet],
  );
  const chosen = candidates.filter(
    (candidate): candidate is ImportCandidate & { event: Event } =>
      candidate.event !== null && !excluded.has(candidate.id),
  );
  const flagged = candidates.filter((c) => c.issues.length > 0).length;

  function selectSheet(name: string, available: ScheduleSheet[]) {
    const next = available.find((candidate) => candidate.name === name);
    setSheetName(name);
    setExcluded(new Set());
    setSelection(
      next
        ? defaultSelection(
            summarizeSubjects(
              next.blocks.map((block) => parseScheduleBlock(block)),
              next.knownSubjects,
            ),
          )
        : {},
    );
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (file.size > maxScheduleFileBytes) {
      setReadError(readErrorMessages['too-large']);
      return;
    }

    setReading(true);
    setReadError(null);
    try {
      const result = await readScheduleWorkbook(await readFileBytes(file));
      if (!result.success) {
        setReadError(readErrorMessages[result.error]);
        return;
      }
      setSheets(result.sheets);
      selectSheet(result.sheets[0]?.name ?? '', result.sheets);
    } catch {
      setReadError(readErrorMessages['read-failed']);
    } finally {
      setReading(false);
    }
  }

  function updateChoice(key: string, change: Partial<SubjectChoice>) {
    setSelection((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { include: true, group: null }), ...change },
    }));
  }

  function toggleCandidate(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="modal-backdrop">
      <section
        className="event-form-modal schedule-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-import-title"
      >
        <header className="form-header">
          <div>
            <p className="eyebrow">IMPORT PLANU</p>
            <h2 id="schedule-import-title">Import z Excela</h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>

        <div className="event-form schedule-import">
          <label className="form-field">
            <span>Plik planu (.xlsx)</span>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              autoFocus
              disabled={reading}
              onChange={(event) => void handleFile(event)}
              type="file"
            />
          </label>
          {reading && <p role="status">Wczytywanie planu…</p>}
          {readError && (
            <p className="form-errors" role="alert">
              {readError}
            </p>
          )}

          {sheet && (
            <>
              <div className="form-grid">
                {sheets.length > 1 && (
                  <label className="form-field">
                    <span>Arkusz</span>
                    <select
                      onChange={(event) =>
                        selectSheet(event.target.value, sheets)
                      }
                      value={sheetName}
                    >
                      {sheets.map((candidate) => (
                        <option key={candidate.name} value={candidate.name}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="form-field">
                  <span>Początek semestru (tydzień 1)</span>
                  <input
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                    type="date"
                    value={startDate}
                  />
                </label>
              </div>
              <p className="field-hint">
                Tygodnie z planu liczone są od tej daty. Tygodnie w całości
                wolne, np. przerwa świąteczna z ustawień semestru, są pomijane.
              </p>

              <fieldset className="form-section">
                <legend>Przedmioty i Twoje grupy</legend>
                <ul className="import-subjects">
                  {subjects.map((subject) => {
                    const choice = selection[subject.key] ?? {
                      include: false,
                      group: null,
                    };
                    const label = `${subject.subject} · ${
                      subject.classType
                        ? classTypeLabels[subject.classType]
                        : 'typ nieznany'
                    }`;

                    return (
                      <li key={subject.key}>
                        <label className="import-subject-name">
                          <input
                            checked={choice.include}
                            onChange={(event) =>
                              updateChoice(subject.key, {
                                include: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          <span>
                            {label}
                            {subject.elective && (
                              <em className="import-badge"> do wyboru</em>
                            )}
                          </span>
                        </label>
                        {subject.groups.length > 0 && (
                          <select
                            aria-label={`Grupa: ${label}`}
                            disabled={!choice.include}
                            onChange={(event) =>
                              updateChoice(subject.key, {
                                group: event.target.value || null,
                              })
                            }
                            value={choice.group ?? ''}
                          >
                            <option value="">Wybierz grupę</option>
                            {subject.groups.map((group) => (
                              <option key={group} value={group}>
                                gr. {group}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              <fieldset className="form-section">
                <legend>
                  Podgląd: {chosen.length} z {candidates.length} zajęć
                  {flagged > 0 && `, ${flagged} wymaga uwagi`}
                </legend>
                {candidates.length === 0 ? (
                  <p className="details-empty">
                    Zaznacz przedmioty i wybierz grupy, aby zobaczyć zajęcia.
                  </p>
                ) : (
                  <ul className="import-preview">
                    {candidates.map((candidate) => (
                      <li
                        className={
                          candidate.issues.length > 0 ? 'has-issues' : ''
                        }
                        key={candidate.id}
                      >
                        <label>
                          <input
                            checked={
                              candidate.event !== null &&
                              !excluded.has(candidate.id)
                            }
                            disabled={candidate.event === null}
                            onChange={() => toggleCandidate(candidate.id)}
                            type="checkbox"
                          />
                          <span className="import-preview-main">
                            <strong>{candidate.subject}</strong>
                            <span>
                              {candidate.weekday
                                ? weekdayLabels[candidate.weekday]
                                : '?'}{' '}
                              {candidate.startTime ?? '?'}–
                              {candidate.endTime ?? '?'}
                              {candidate.classType &&
                                ` · ${classTypeLabels[candidate.classType]}`}
                              {candidate.group && ` · gr. ${candidate.group}`}
                            </span>
                            <span>
                              tyg. {formatWeeks(candidate.weeks) || '?'}
                              {candidate.event &&
                                ` (${candidate.event.recurrence.startDate} – ${candidate.event.recurrence.endDate})`}{' '}
                              · {candidate.room} / {candidate.building}
                            </span>
                          </span>
                        </label>
                        {candidate.issues.length > 0 && (
                          <ul className="import-issues">
                            {candidate.issues.map((issue) => (
                              <li key={`${issue.code}-${issue.detail ?? ''}`}>
                                {issueMessage(issue)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              <label className="interval-option">
                <input
                  checked={replace}
                  onChange={(event) => setReplace(event.target.checked)}
                  type="checkbox"
                />
                <span>Zastąp obecny plan zamiast dopisywać zajęcia</span>
              </label>
            </>
          )}

          {saveError && (
            <p className="form-errors" role="alert">
              {saveError}
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
            <button
              className="primary-button"
              disabled={chosen.length === 0}
              type="button"
              onClick={() =>
                onImport({
                  events: chosen.map((candidate) => candidate.event),
                  semesterStartDate: startDate,
                  replace,
                })
              }
            >
              Importuj {chosen.length} zajęć
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
