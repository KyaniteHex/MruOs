import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  academicWeekCalendar,
  buildImportCandidates,
  calendarWeeks,
  calendarWeeksFrom,
  defaultSelection,
  parseScheduleBlock,
  semesterWeekCalendar,
  subjectKey,
  summarizeSubjects,
  termForDate,
  todayInWarsaw,
} from '@mruos/shared';
import type {
  AcademicTerm,
  AcademicYear,
  ClassType,
  Event,
  ImportCandidate,
  ImportIssue,
  ImportOptions,
  ImportSelection,
  ParsedBlock,
  Semester,
  SubjectChoice,
  Weekday,
} from '@mruos/shared';
import type { UgPlan } from '@mruos/shared/ugSchedule';
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
  /** Set when weeks were counted from a start date, not the calendar. */
  semesterStartDate?: string;
  replace: boolean;
};

/** UMK CM plans drawn in Excel, or UG plans printed to PDF from CELCAT. */
export type ScheduleImportFormat = 'xlsx-umk' | 'pdf-ug';

type ScheduleImportProps = {
  format: ScheduleImportFormat;
  semester: Semester;
  /** The current plan, checked for overlaps unless it is replaced. */
  existingSeries: readonly EventSeries[];
  colorFor: (classType: ClassType) => string;
  saveError?: string;
  onCancel: () => void;
  onImport: (result: ScheduleImportResult) => void;
  /** Opens the academic year settings, e.g. before importing a plan. */
  onOpenAcademicYear?: () => void;
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

const ugReadError =
  'Nie rozpoznano planu zajęć UG. Wybierz plan w formacie PDF pobrany ze strony Wydziału Ekonomicznego UG.';

const parityLabels = {
  odd: 'tydzień I',
  even: 'tydzień II',
  all: 'co tydzień',
} as const;

/** Group letters are short; seminar alternatives are named by teachers. */
function isTeacherChoice(groups: readonly string[]): boolean {
  return groups.some((group) => group.length > 3);
}

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
    case 'guessed-type':
      return `Typ „${issue.detail ?? ''}” zapisano jako wykład. Sprawdź po imporcie.`;
    case 'date-unmatched':
      return `Data ${issue.detail ?? ''} z planu nie pasuje do terminów zajęć.`;
    case 'unparsed-text':
      return `Nierozpoznany tekst: „${issue.detail ?? ''}”.`;
    case 'invalid-event':
      return 'Niepoprawne dane zajęć (np. koniec przed początkiem).';
    case 'week-out-of-range':
      return `Semestr ma mniej tygodni zajęć niż plan (tydz. ${issue.detail ?? ''}).`;
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

// "…_rok5_sem9.xlsx": odd semesters are winter ones at Polish universities.
function guessTerm(fileName: string, year: AcademicYear): AcademicTerm {
  const available = year.semesters.map((semester) => semester.term);
  const number = Number(/sem(?:estr)?\D?(\d+)/i.exec(fileName)?.[1]);
  const fromName: AcademicTerm | null = Number.isInteger(number)
    ? number % 2 === 1
      ? 'winter'
      : 'summer'
    : null;
  const preferred = fromName ?? termForDate(year, todayInWarsaw());

  return preferred && available.includes(preferred)
    ? preferred
    : (available[0] ?? 'winter');
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
  format,
  semester,
  existingSeries,
  colorFor,
  saveError,
  onCancel,
  onImport,
  onOpenAcademicYear,
}: ScheduleImportProps) {
  useDialogKeyboard(onCancel);
  const [sheets, setSheets] = useState<ScheduleSheet[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [ugPlan, setUgPlan] = useState<UgPlan | null>(null);
  const [ugGroup, setUgGroup] = useState('');
  const isUg = format === 'pdf-ug';
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const academicYear =
    semester.academicYear && semester.academicYear.semesters.length > 0
      ? semester.academicYear
      : null;
  const [startDate, setStartDate] = useState(semester.startDate);
  const [term, setTerm] = useState<AcademicTerm>(
    () => academicYear?.semesters[0]?.term ?? 'winter',
  );
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  // Weeks follow the academic calendar when there is one, otherwise 7-day
  // windows from the start date entered here. UG counts calendar weeks.
  const weekOptions = useMemo<Pick<
    ImportOptions,
    'weekDate' | 'weekDates' | 'weekCount' | 'dayPlans'
  > | null>(() => {
    if (isUg) {
      const weeks = academicYear
        ? calendarWeeks(academicYear, term)
        : validStart
          ? calendarWeeksFrom(startDate)
          : null;
      return weeks
        ? {
            weekDate: (week, weekday) =>
              weeks.weekDates(week, weekday)[0] ?? null,
            weekDates: weeks.weekDates,
            weekCount: weeks.weekCount,
            dayPlans: academicYear?.dayPlans ?? [],
          }
        : null;
    }
    const weekDate = academicYear
      ? academicWeekCalendar(academicYear, term)
      : validStart
        ? semesterWeekCalendar({ startDate, daysOff: semester.daysOff })
        : null;
    return weekDate ? { weekDate } : null;
  }, [isUg, academicYear, term, validStart, startDate, semester.daysOff]);
  const [selection, setSelection] = useState<ImportSelection>({});
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [replace, setReplace] = useState(false);

  const sheet = sheets.find((candidate) => candidate.name === sheetName);
  const blocks = useMemo<ParsedBlock[]>(
    () =>
      isUg
        ? (ugPlan?.blocks ?? [])
        : (sheet?.blocks.map((block) => parseScheduleBlock(block)) ?? []),
    [isUg, ugPlan, sheet],
  );
  const loaded = isUg ? ugPlan !== null : sheet !== undefined;
  const subjects = useMemo(
    () => summarizeSubjects(blocks, sheet?.knownSubjects),
    [blocks, sheet],
  );
  const candidates = useMemo(
    () =>
      weekOptions
        ? buildImportCandidates(blocks, {
            ...weekOptions,
            selection,
            colorFor,
            knownSubjects: sheet?.knownSubjects,
          })
        : [],
    [blocks, weekOptions, selection, colorFor, sheet],
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
    if (!weekOptions) {
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
            ...weekOptions,
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
  }, [subjects, blocks, weekOptions, semester, colorFor]);

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

  /** Puts the classes of every subject taught in groups on that group. */
  function chooseUgGroup(group: string) {
    setUgGroup(group);
    setSelection((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, choice]) => {
          const subject = subjects.find((candidate) => candidate.key === key);
          const byLetter =
            subject !== undefined &&
            subject.groups.length > 0 &&
            !isTeacherChoice(subject.groups);
          return [
            key,
            byLetter
              ? {
                  ...choice,
                  group: subject.groups.includes(group) ? group : null,
                }
              : choice,
          ];
        }),
      ),
    );
  }

  async function handleUgFile(file: File) {
    try {
      const { readUgPlan } = await import('@mruos/shared/ugSchedule');
      const plan = await readUgPlan(new Uint8Array(await readFileBytes(file)));
      setUgPlan(plan);
      setUgGroup('');
      setExcluded(new Set());
      setSelection(defaultSelection(summarizeSubjects(plan.blocks)));
      const available = academicYear?.semesters.map((s) => s.term) ?? [];
      if (plan.term && available.includes(plan.term)) {
        setTerm(plan.term);
      }
    } catch {
      setUgPlan(null);
      setReadError(ugReadError);
    }
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
    if (isUg) {
      await handleUgFile(file);
      setReading(false);
      return;
    }
    try {
      const result = await readScheduleWorkbook(await readFileBytes(file));
      if (!result.success) {
        setReadError(readErrorMessages[result.error]);
        return;
      }
      setSheets(result.sheets);
      selectSheet(result.sheets[0]?.name ?? '', result.sheets);
      if (academicYear) {
        setTerm(guessTerm(file.name, academicYear));
      }
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
            <h2 id="schedule-import-title">
              {isUg ? 'Import z PDF (UG)' : 'Import z Excela'}
            </h2>
          </div>
          <button className="icon-close" type="button" onClick={onCancel}>
            Zamknij
          </button>
        </header>

        <div className="event-form schedule-import">
          {!academicYear && (
            <div className="import-calendar-hint" role="note">
              <p>
                Nie masz jeszcze harmonogramu roku akademickiego. Bez niego
                tygodnie planu są liczone od daty początku semestru, bez przerw
                i dni wolnych uczelni. Zaimportowane zajęcia zachowają te daty
                także po późniejszym ustawieniu harmonogramu.
              </p>
              {onOpenAcademicYear && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={onOpenAcademicYear}
                >
                  Uzupełnij harmonogram
                </button>
              )}
            </div>
          )}
          <label className="form-field">
            <span>{isUg ? 'Plik planu (.pdf)' : 'Plik planu (.xlsx)'}</span>
            <input
              accept={
                isUg
                  ? '.pdf,application/pdf'
                  : '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              }
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

          {loaded && (
            <>
              {ugPlan && (
                <p className="import-plan-info">
                  {[
                    ugPlan.faculty,
                    ugPlan.programme,
                    ugPlan.academicYear &&
                      `semestr ${ugPlan.term === 'summer' ? 'letni' : 'zimowy'} ${ugPlan.academicYear}`,
                    ugPlan.version,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <div className="form-grid">
                {ugPlan && ugPlan.groups.length > 0 && (
                  <label className="form-field">
                    <span>Twoja grupa</span>
                    <select
                      onChange={(event) => chooseUgGroup(event.target.value)}
                      value={ugGroup}
                    >
                      <option value="">Wybierz grupę</option>
                      {ugPlan.groups.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
                {academicYear ? (
                  <label className="form-field">
                    <span>Semestr</span>
                    <select
                      onChange={(event) =>
                        setTerm(event.target.value as AcademicTerm)
                      }
                      value={term}
                    >
                      {academicYear.semesters.map((candidate) => (
                        <option key={candidate.term} value={candidate.term}>
                          {candidate.term === 'winter'
                            ? 'Semestr zimowy'
                            : 'Semestr letni'}{' '}
                          ({formatDate(candidate.startDate)} –{' '}
                          {formatDate(candidate.endDate)})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="form-field">
                    <span>Początek semestru (tydzień 1)</span>
                    <input
                      onChange={(event) => setStartDate(event.target.value)}
                      required
                      type="date"
                      value={startDate}
                    />
                  </label>
                )}
              </div>
              <p className="field-hint">
                {isUg
                  ? 'Tydzień I i II liczone są jak na UG: nieparzyste i parzyste tygodnie kalendarzowe od tygodnia, w którym zaczynają się zajęcia, także w czasie przerw. W dni wolne zajęcia są odwołane.'
                  : academicYear
                    ? 'Tydzień N to N-ty dzień zajęć w okresach „Zajęcia” wybranego semestru z harmonogramu roku akademickiego. W dni wolne zajęcia są odwołane.'
                    : 'Tygodnie z planu liczone są od tej daty. Uzupełnij harmonogram roku akademickiego, aby liczyć je według okresów zajęć.'}
              </p>

              <fieldset className="form-section">
                <legend>
                  {isUg ? 'Przedmioty' : 'Przedmioty i Twoje grupy'}
                </legend>
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
                            aria-label={`${
                              isTeacherChoice(subject.groups)
                                ? 'Prowadzący'
                                : 'Grupa'
                            }: ${label}`}
                            disabled={!choice.include}
                            onChange={(event) =>
                              updateChoice(subject.key, {
                                group: event.target.value || null,
                              })
                            }
                            value={choice.group ?? ''}
                          >
                            <option value="">
                              {isTeacherChoice(subject.groups)
                                ? 'Wybierz prowadzącego'
                                : 'Wybierz grupę'}
                            </option>
                            {subject.groups.map((group) => (
                              <option key={group} value={group}>
                                {isTeacherChoice(subject.groups)
                                  ? group
                                  : `gr. ${group}`}
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
                              {candidate.group &&
                                !isTeacherChoice([candidate.group]) &&
                                ` · gr. ${candidate.group}`}
                            </span>
                            <span>
                              {candidate.parity
                                ? parityLabels[candidate.parity]
                                : `tyg. ${formatWeeks(candidate.weeks) || '?'}`}
                              {candidate.event &&
                                ` (${candidate.event.recurrence.startDate} – ${candidate.event.recurrence.endDate})`}{' '}
                              · {candidate.room} / {candidate.building}
                            </span>
                            {candidate.teacher && (
                              <span>{candidate.teacher}</span>
                            )}
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
                  ...(academicYear ? {} : { semesterStartDate: startDate }),
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
