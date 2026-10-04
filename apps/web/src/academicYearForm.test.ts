import { describe, expect, it } from 'vitest';
import {
  changeAcademicYear,
  createAcademicYearDraft,
  draftToAcademicYear,
  restoreHolidays,
} from './academicYearForm';
import type { AcademicYearDraft, SemesterDraft } from './academicYearForm';

function fill(
  semester: SemesterDraft,
  startDate: string,
  endDate: string,
  dates: [string, string][],
): SemesterDraft {
  return {
    ...semester,
    startDate,
    endDate,
    rows: semester.rows.map((row, index) => ({
      ...row,
      startDate: dates[index]?.[0] ?? '',
      endDate: dates[index]?.[1] ?? '',
    })),
  };
}

function umkWinter(draft: AcademicYearDraft): AcademicYearDraft {
  const [winter, summer] = draft.semesters;
  if (!winter || !summer) throw new Error('Missing semesters');

  return {
    ...draft,
    semesters: [
      fill(winter, '2026-10-01', '2027-02-21', [
        ['2026-10-01', ''],
        ['2026-10-02', '2026-12-20'],
        ['2026-12-21', '2027-01-06'],
        ['2027-01-07', '2027-02-04'],
        ['2027-02-05', '2027-02-18'],
        ['2027-02-20', '2027-02-28'],
        ['2027-02-19', ''],
      ]),
      summer,
    ],
  };
}

describe('createAcademicYearDraft', () => {
  it('prefills row names, empty dates and the statutory holidays', () => {
    const draft = createAcademicYearDraft(
      { startDate: '2026-09-28', daysOff: ['2026-11-11', '2026-11-12'] },
      '2026-10-04',
    );

    expect(draft.startYear).toBe(2026);
    expect(draft.semesters.map((s) => s.rows.map((row) => row.label))).toEqual([
      [
        'Inauguracja roku akademickiego',
        'Zajęcia dydaktyczne',
        'Wakacje zimowe',
        'Zajęcia dydaktyczne',
        'Egzaminacyjna sesja zimowa',
        'Egzaminacyjna sesja zimowa poprawkowa',
        'Święto uczelni',
      ],
      [
        'Zajęcia dydaktyczne',
        'Wakacje wiosenne',
        'Zajęcia dydaktyczne',
        'Egzaminacyjna sesja letnia',
        'Wakacje letnie',
        'Egzaminacyjna sesja poprawkowa',
      ],
    ]);
    expect(
      draft.semesters.every((s) => s.rows.every((row) => !row.startDate)),
    ).toBe(true);
    // 14 holidays plus the extra day off kept from the old settings.
    expect(draft.daysOff).toHaveLength(15);
    expect(draft.daysOff[2]).toMatchObject({
      date: '2026-11-12',
      label: 'Dzień wolny',
    });
  });
});

describe('editing the days off', () => {
  const draft = createAcademicYearDraft(
    { startDate: '2026-09-28', daysOff: [] },
    '2026-10-04',
  );

  it('swaps statutory holidays when the year changes but keeps own rows', () => {
    const edited = {
      ...draft,
      daysOff: [
        ...draft.daysOff.filter((row) => row.date !== '2026-11-01'),
        { key: 'own', date: '2026-11-02', label: 'Dzień rektorski' },
      ],
    };

    const next = changeAcademicYear(edited, 2027);

    expect(next.daysOff.map((row) => row.date)).toContain('2027-11-01');
    expect(next.daysOff.map((row) => row.date)).not.toContain('2026-11-11');
    expect(next.daysOff).toContainEqual({
      key: 'own',
      date: '2026-11-02',
      label: 'Dzień rektorski',
    });
  });

  it('restores removed holidays without touching edited ones', () => {
    const edited = {
      ...draft,
      daysOff: draft.daysOff
        .filter((row) => row.date !== '2026-12-24')
        .map((row) =>
          row.date === '2026-11-11' ? { ...row, label: 'Święto' } : row,
        ),
    };

    const restored = restoreHolidays(edited);

    expect(restored.daysOff).toHaveLength(14);
    expect(
      restored.daysOff.find((row) => row.date === '2026-11-11')?.label,
    ).toBe('Święto');
  });
});

describe('draftToAcademicYear', () => {
  const draft = createAcademicYearDraft(
    { startDate: '2026-09-28', daysOff: [] },
    '2026-10-04',
  );

  it('saves filled semesters and skips an untouched one', () => {
    const result = draftToAcademicYear(umkWinter(draft));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.academicYear.semesters).toHaveLength(1);
    expect(result.academicYear.semesters[0]?.periods[0]).toEqual({
      label: 'Inauguracja roku akademickiego',
      kind: 'event',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
    });
    expect(result.academicYear.daysOff).toHaveLength(14);
  });

  it('lists what is missing or wrong', () => {
    const filled = umkWinter(draft);
    const [winter, summer] = filled.semesters;
    if (!winter || !summer) throw new Error('Missing semesters');
    const broken: AcademicYearDraft = {
      ...filled,
      semesters: [
        {
          ...winter,
          rows: winter.rows.map((row, index) =>
            index === 3
              ? { ...row, startDate: '2026-12-01', endDate: '2027-02-04' }
              : index === 6
                ? { ...row, startDate: '' }
                : row,
          ),
        },
        { ...summer, startDate: '2027-02-22' },
      ],
      daysOff: [
        ...filled.daysOff,
        { key: 'x', date: '', label: 'Dzień rektorski' },
      ],
    };

    const result = draftToAcademicYear(broken);

    expect(result).toEqual({
      success: false,
      errors: [
        'Semestr zimowy, „Święto uczelni”: uzupełnij datę lub usuń pozycję.',
        'Semestr zimowy: okresy zajęć nachodzą na siebie.',
        'Semestr letni: podaj daty od i do.',
        'Semestr letni, „Zajęcia dydaktyczne”: uzupełnij datę lub usuń pozycję.',
        'Semestr letni, „Wakacje wiosenne”: uzupełnij datę lub usuń pozycję.',
        'Semestr letni, „Zajęcia dydaktyczne”: uzupełnij datę lub usuń pozycję.',
        'Semestr letni, „Egzaminacyjna sesja letnia”: uzupełnij datę lub usuń pozycję.',
        'Semestr letni, „Wakacje letnie”: uzupełnij datę lub usuń pozycję.',
        'Semestr letni, „Egzaminacyjna sesja poprawkowa”: uzupełnij datę lub usuń pozycję.',
        'Dni wolne, „Dzień rektorski”: uzupełnij datę lub usuń pozycję.',
      ],
    });
  });
});
