import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  buildImportCandidates,
  defaultSelection,
  parseScheduleBlock,
  subjectKey,
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
import type { EventSeries } from './calendarEvents';
import { classTypeLabels } from './eventFormModel';
import {
  buildSlotIndex,
  eventSlots,
  findEntryConflicts,
  findSlotConflicts,
} from './importConflicts';
import type {
  EntryConflict,
  OccurrenceSlot,
  ScheduleEntry,
} from './importConflicts';
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
  /** The current plan, checked for overlaps unless it is replaced. */
  existingSeries: readonly EventSeries[];
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

function formatDate(isoDate: string): string {
  return isoDate.split('-').reverse().join('.');
}

function datesLabel(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return '1 termin';
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} terminy`;
  }
  return `${count} terminów`;
}

function conflictMessage(conflict: EntryConflict): string {
  const owner = conflict.existing ? ' (w Twoim planie)' : '';

  return `${conflict.subject}${owner}, ${conflict.startTime}–${conflict.endTime}: ${datesLabel(conflict.dates.length)}, od ${formatDate(conflict.dates[0] ?? '')}`;
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
  existingSeries,
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
  const chosen = useMemo(
    () =>
      candidates.filter(
        (candidate): candidate is ImportCandidate & { event: Event } =>
          candidate.event !== null && !excluded.has(candidate.id),
      ),
    [candidates, excluded],
  );
  const flagged = candidates.filter((c) => c.issues.length > 0).length;

  const planEntries = useMemo<ScheduleEntry[]>(
    () =>
      replace
        ? []
        : existingSeries.map((series) => ({
            id: `plan:${series.id}`,
            event: series.event,
            existing: true,
          })),
    [replace, existingSeries],
  );
  const slotIndex = useMemo(
    () =>
      buildSlotIndex(
        [
          ...planEntries,
          ...chosen.map((candidate) => ({
            id: candidate.id,
            event: candidate.event,
            existing: false,
          })),
        ],
        semester,
      ),
    [chosen, planEntries, semester],
  );
  const conflicts = useMemo(
    () =>
      new Map(
        chosen.map((candidate) => [
          candidate.id,
          findEntryConflicts(
            candidate.id,
            candidate.event,
            slotIndex,
            semester,
          ),
        ]),
      ),
    [chosen, slotIndex, semester],
  );
  const conflictCount = [...conflicts.values()].filter(
    (list) => list.length > 0,
  ).length;

  // Dated slots of every group option; they depend on the file and the
  // semester only, so changing the chosen groups does not rebuild them.
  const groupOptionSlots = useMemo(() => {
    const options = new Map<string, Map<string, OccurrenceSlot[][]>>();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return options;
    }
    for (const subject of subjects.filter((s) => s.groups.length > 0)) {
      const subjectBlocks = blocks.filter(
        (block) => subjectKey(block) === subject.key,
      );
      const groups = new Map<string, OccurrenceSlot[][]>();
      for (const group of subject.groups) {
        groups.set(
          group,
          buildImportCandidates(subjectBlocks, {
            semester: { startDate, daysOff: semester.daysOff },
            selection: { [subject.key]: { include: true, group } },
            colorFor,
          }).flatMap((option) =>
            option.event ? [eventSlots(option.event, semester)] : [],
          ),
        );
      }
      options.set(subject.key, groups);
    }

    return options;
  }, [subjects, blocks, startDate, semester, colorFor]);

  // Groups that would overlap the classes chosen for other subjects, so the
  // student sees which groups fit before picking one.
  const conflictingGroups = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const [key, groups] of groupOptionSlots) {
      const ownClasses = new Set(
        chosen
          .filter((candidate) => candidate.subjectKey === key)
          .map((candidate) => candidate.id),
      );
      const clashing = new Set<string>();
      for (const [group, options] of groups) {
        if (
          options.some(
            (slots) =>
              findSlotConflicts(`option:${group}`, slots, slotIndex, ownClasses)
                .length > 0,
          )
        ) {
          clashing.add(group);
        }
      }
      result.set(key, clashing);
    }

    return result;
  }, [groupOptionSlots, chosen, slotIndex]);

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
                    const subjectConflicts = chosen
                      .filter(
                        (candidate) => candidate.subjectKey === subject.key,
                      )
                      .flatMap(
                        (candidate) => conflicts.get(candidate.id) ?? [],
                      );

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
                                {conflictingGroups.get(subject.key)?.has(group)
                                  ? ' – kolizja'
                                  : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        {subjectConflicts.length > 0 && (
                          <ul className="import-conflicts">
                            {subjectConflicts.map((conflict, index) => (
                              <li key={`${conflict.id}-${index}`}>
                                Koliduje z: {conflictMessage(conflict)}
                              </li>
                            ))}
                          </ul>
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
                  {conflictCount > 0 && `, ${conflictCount} z kolizją`}
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
                          (conflicts.get(candidate.id)?.length ?? 0) > 0
                            ? 'has-conflicts'
                            : candidate.issues.length > 0
                              ? 'has-issues'
                              : ''
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
                        {(conflicts.get(candidate.id)?.length ?? 0) > 0 && (
                          <ul className="import-conflicts">
                            {conflicts.get(candidate.id)?.map((conflict) => (
                              <li key={conflict.id}>
                                Koliduje z: {conflictMessage(conflict)}
                              </li>
                            ))}
                          </ul>
                        )}
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
