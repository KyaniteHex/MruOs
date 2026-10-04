import {
  AcademicYearSchema,
  academicStartYear,
  polishPublicHolidays,
} from '@mruos/shared';
import type {
  AcademicPeriodKind,
  AcademicSemester,
  AcademicTerm,
  AcademicYear,
  Semester,
} from '@mruos/shared';

// Editable state of the "Rok akademicki" dialog. Dates may be empty while
// the student fills the form; draftToAcademicYear validates them on save.

export type PeriodRow = {
  key: string;
  label: string;
  kind: AcademicPeriodKind;
  startDate: string;
  endDate: string;
};

export type SemesterDraft = {
  term: AcademicTerm;
  startDate: string;
  endDate: string;
  rows: PeriodRow[];
};

export type DayOffRow = { key: string; date: string; label: string };

export type AcademicYearDraft = {
  startYear: number;
  semesters: SemesterDraft[];
  daysOff: DayOffRow[];
};

export const periodKindLabels: Record<AcademicPeriodKind, string> = {
  teaching: 'Zajęcia',
  break: 'Przerwa',
  exams: 'Sesja',
  event: 'Wydarzenie',
  'day-off': 'Dzień wolny',
};

export const termLabels: Record<AcademicTerm, string> = {
  winter: 'Semestr zimowy',
  summer: 'Semestr letni',
};

// Row names of a typical Polish university calendar; dates are left empty.
const templates: Record<AcademicTerm, [string, AcademicPeriodKind][]> = {
  winter: [
    ['Inauguracja roku akademickiego', 'event'],
    ['Zajęcia dydaktyczne', 'teaching'],
    ['Wakacje zimowe', 'break'],
    ['Zajęcia dydaktyczne', 'teaching'],
    ['Egzaminacyjna sesja zimowa', 'exams'],
    ['Egzaminacyjna sesja zimowa poprawkowa', 'exams'],
    ['Święto uczelni', 'day-off'],
  ],
  summer: [
    ['Zajęcia dydaktyczne', 'teaching'],
    ['Wakacje wiosenne', 'break'],
    ['Zajęcia dydaktyczne', 'teaching'],
    ['Egzaminacyjna sesja letnia', 'exams'],
    ['Wakacje letnie', 'break'],
    ['Egzaminacyjna sesja poprawkowa', 'exams'],
  ],
};

const terms: AcademicTerm[] = ['winter', 'summer'];
const otherDayOffLabel = 'Dzień wolny';
let keySequence = 0;

export function rowKey(): string {
  keySequence += 1;
  return `row-${keySequence}`;
}

function sortDaysOff(rows: DayOffRow[]): DayOffRow[] {
  // Rows without a date stay at the end, where they were added.
  return [...rows].sort((left, right) =>
    left.date && right.date ? left.date.localeCompare(right.date) : 0,
  );
}

function holidayRows(startYear: number): DayOffRow[] {
  return polishPublicHolidays(startYear).map((holiday) => ({
    ...holiday,
    key: rowKey(),
  }));
}

export function createAcademicYearDraft(
  semester: Semester,
  today: string,
): AcademicYearDraft {
  const saved = semester.academicYear;
  if (saved) {
    return {
      startYear: saved.startYear,
      semesters: terms.map((term) => {
        const stored = saved.semesters.find((s) => s.term === term);
        return stored
          ? {
              term,
              startDate: stored.startDate,
              endDate: stored.endDate,
              rows: stored.periods.map((period) => ({
                ...period,
                key: rowKey(),
              })),
            }
          : emptySemester(term);
      }),
      daysOff: saved.daysOff.map((dayOff) => ({ ...dayOff, key: rowKey() })),
    };
  }

  const startYear = academicStartYear(today);
  const holidays = holidayRows(startYear);
  const holidayDates = new Set(holidays.map((row) => row.date));
  // Days off from the older semester settings had no names.
  const previous = semester.daysOff
    .filter((date) => !holidayDates.has(date))
    .map((date) => ({ key: rowKey(), date, label: otherDayOffLabel }));

  return {
    startYear,
    semesters: terms.map(emptySemester),
    daysOff: sortDaysOff([...holidays, ...previous]),
  };
}

function emptySemester(term: AcademicTerm): SemesterDraft {
  return {
    term,
    startDate: '',
    endDate: '',
    rows: templates[term].map(([label, kind]) => ({
      key: rowKey(),
      label,
      kind,
      startDate: '',
      endDate: '',
    })),
  };
}

/** Swaps the statutory holidays for those of `startYear`, keeping own rows. */
export function changeAcademicYear(
  draft: AcademicYearDraft,
  startYear: number,
): AcademicYearDraft {
  const previous = new Set(
    polishPublicHolidays(draft.startYear).map(
      (holiday) => `${holiday.date}|${holiday.label}`,
    ),
  );
  const ownRows = draft.daysOff.filter(
    (row) => !previous.has(`${row.date}|${row.label}`),
  );

  return {
    ...draft,
    startYear,
    daysOff: sortDaysOff([...holidayRows(startYear), ...ownRows]),
  };
}

/** Adds back statutory holidays that were removed from the list. */
export function restoreHolidays(draft: AcademicYearDraft): AcademicYearDraft {
  const dates = new Set(draft.daysOff.map((row) => row.date));
  const missing = holidayRows(draft.startYear).filter(
    (row) => !dates.has(row.date),
  );

  return { ...draft, daysOff: sortDaysOff([...draft.daysOff, ...missing]) };
}

export type AcademicYearResult =
  | { success: true; academicYear: AcademicYear }
  | { success: false; errors: string[] };

function rowName(row: PeriodRow, index: number): string {
  return row.label.trim() || `Pozycja ${index + 1}`;
}

export function draftToAcademicYear(
  draft: AcademicYearDraft,
): AcademicYearResult {
  const errors: string[] = [];
  const semesters: AcademicSemester[] = [];

  for (const semester of draft.semesters) {
    const name = termLabels[semester.term];
    const hasDates =
      semester.startDate ||
      semester.endDate ||
      semester.rows.some((row) => row.startDate || row.endDate);
    if (!hasDates) {
      // A semester left empty is simply not part of the calendar.
      continue;
    }
    if (!semester.startDate || !semester.endDate) {
      errors.push(`${name}: podaj daty od i do.`);
    } else if (semester.endDate < semester.startDate) {
      errors.push(`${name}: koniec semestru musi być po jego początku.`);
    }

    const periods = semester.rows.flatMap((row, index) => {
      const label = rowName(row, index);
      if (!row.label.trim()) {
        errors.push(`${name}: podaj nazwę pozycji ${index + 1}.`);
      }
      if (!row.startDate) {
        errors.push(`${name}, „${label}”: uzupełnij datę lub usuń pozycję.`);
        return [];
      }
      const endDate = row.endDate || row.startDate;
      if (endDate < row.startDate) {
        errors.push(`${name}, „${label}”: data „do” jest przed datą „od”.`);
        return [];
      }
      return [
        {
          label: row.label.trim(),
          kind: row.kind,
          startDate: row.startDate,
          endDate,
        },
      ];
    });

    const teaching = periods
      .filter((period) => period.kind === 'teaching')
      .sort((left, right) => left.startDate.localeCompare(right.startDate));
    if (
      teaching.some(
        (period, index) =>
          index > 0 && period.startDate <= (teaching[index - 1]?.endDate ?? ''),
      )
    ) {
      errors.push(`${name}: okresy zajęć nachodzą na siebie.`);
    }

    semesters.push({
      term: semester.term,
      startDate: semester.startDate,
      endDate: semester.endDate,
      periods,
    });
  }

  const seenDates = new Set<string>();
  const daysOff = draft.daysOff.flatMap((row) => {
    if (!row.date) {
      errors.push(
        `Dni wolne, „${row.label.trim() || 'nowy dzień'}”: uzupełnij datę lub usuń pozycję.`,
      );
      return [];
    }
    if (!row.label.trim()) {
      errors.push(`Dni wolne, ${row.date}: podaj opis.`);
    }
    if (seenDates.has(row.date)) {
      errors.push(`Dni wolne: data ${row.date} występuje więcej niż raz.`);
    }
    seenDates.add(row.date);
    return [{ date: row.date, label: row.label.trim() }];
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const parsed = AcademicYearSchema.safeParse({
    startYear: draft.startYear,
    semesters,
    daysOff,
  });

  return parsed.success
    ? { success: true, academicYear: parsed.data }
    : { success: false, errors: ['Sprawdź daty w harmonogramie.'] };
}
