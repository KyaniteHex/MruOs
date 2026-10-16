import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calendarWeeks } from './academicYear.js';
import { expandOccurrences } from './recurrence.js';
import {
  buildImportCandidates,
  defaultSelection,
  summarizeSubjects,
} from './scheduleImport.js';
import type { ImportSelection } from './scheduleImport.js';
import type { AcademicYear, Event } from './types.js';
import { UgPlanError, readUgPlan } from './ugSchedule.js';

const plans = join(process.cwd(), '../../e2e/fixtures/plans');

async function plan(name: string) {
  return readUgPlan(new Uint8Array(await readFile(join(plans, name))));
}

// UG 2026/2027 (Zarządzenie Rektora nr 26/R/26).
const ug: AcademicYear = {
  startYear: 2026,
  semesters: [
    {
      term: 'winter',
      startDate: '2026-10-01',
      endDate: '2027-02-21',
      periods: [
        {
          label: 'Zajęcia dydaktyczne',
          kind: 'teaching',
          startDate: '2026-10-01',
          endDate: '2026-12-23',
        },
        {
          label: 'Przerwa świąteczna',
          kind: 'break',
          startDate: '2026-12-24',
          endDate: '2027-01-06',
        },
        {
          label: 'Zajęcia dydaktyczne',
          kind: 'teaching',
          startDate: '2027-01-07',
          endDate: '2027-01-31',
        },
      ],
    },
  ],
  daysOff: [{ date: '2026-11-11', label: 'Narodowe Święto Niepodległości' }],
  dayPlans: [
    { date: '2027-01-28', weekday: 'MO' },
    { date: '2027-01-29', weekday: 'WE' },
  ],
};
const semester = { daysOff: ['2026-11-11'], academicYear: ug };

describe('calendarWeeks', () => {
  const weeks = calendarWeeks(ug, 'winter');

  it('counts calendar weeks from the week with the first class day', () => {
    expect(weeks?.weekCount).toBe(18);
    // 1.10 is a Thursday, so Monday 28.09 is before the semester.
    expect(weeks?.weekDates(1, 'MO')).toEqual([]);
    expect(weeks?.weekDates(1, 'TH')).toEqual(['2026-10-01']);
    expect(weeks?.weekDates(2, 'MO')).toEqual(['2026-10-05']);
    // Weeks keep counting through the Christmas break.
    expect(weeks?.weekDates(14, 'MO')).toEqual([]);
    expect(weeks?.weekDates(16, 'MO')).toEqual(['2027-01-11']);
  });

  it('adds days with another weekday’s plan to that weekday', () => {
    expect(weeks?.weekDates(18, 'MO')).toEqual(['2027-01-25', '2027-01-28']);
    expect(weeks?.weekDates(18, 'WE')).toEqual(['2027-01-27', '2027-01-29']);
    expect(weeks?.weekDates(18, 'TH')).toEqual([]);
  });
});

describe('readUgPlan', () => {
  it('reads the plan, its groups and the classes of every group', async () => {
    const first = await plan('15-09-2026-ssl-ek-1.pdf');

    expect(first).toMatchObject({
      faculty: 'Wydział Ekonomiczny UG',
      programme: '1 SS1 EK',
      groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      term: 'winter',
      academicYear: '2026/2027',
      version: 'wersja z 15 IX',
    });
    // Classes shared by all groups appear once.
    expect(first.blocks).toHaveLength(25);
    expect(first.blocks).toContainEqual(
      expect.objectContaining({
        subject: 'Makroekonomia I',
        classType: 'cwiczenia',
        weekday: 'FR',
        room: 'C101',
        building: 'Wydział Ekonomiczny UG',
        teacher: 'Neumann (Dr Lilia)',
        sessions: [
          {
            startTime: '09:45',
            endTime: '11:15',
            weeks: [],
            parity: 'all',
            groups: ['C'],
          },
        ],
      }),
    );
  });

  it('reads notes, one-off meetings, online classes and language blocks', async () => {
    const { blocks } = await plan('15-09-2026-ssl-ek-1.pdf');
    const second = await plan('15-09-2026-ssl-ib-2.pdf');

    expect(
      blocks.find((block) => block.subject.startsWith('Spotkanie')),
    ).toMatchObject({
      subject: 'Spotkanie Prodziekana ze studentami I roku',
      classType: 'wyklad',
      onlyOn: [{ day: 5, month: 10 }],
      sessions: [expect.objectContaining({ weeks: [2] })],
      issues: [{ code: 'guessed-type', detail: 'Spotkanie' }],
    });
    expect(
      blocks.find((block) => block.subject === 'Blok projektowy'),
    ).toMatchObject({
      classType: 'zajecia-praktyczne',
      room: 'Aula O',
      roomChanges: [{ day: 23, month: 10, room: 'C301', building: null }],
      sessions: [expect.objectContaining({ parity: 'even' })],
    });
    expect(
      blocks.filter((block) => block.subject === 'Blok języków obcych'),
    ).toEqual([
      expect.objectContaining({ elective: true, weekday: 'MO' }),
      expect.objectContaining({ elective: true, weekday: 'WE' }),
    ]);
    expect(second.blocks.find((block) => block.remote)).toMatchObject({
      subject: 'Project Management-in Search of Excellence',
      classType: 'wyklad',
      weekday: 'FR',
      room: null,
      teacher: 'Kuczewska (Prof. dr h Joanna)',
    });
  });

  it('turns diploma seminars into a choice of teachers', async () => {
    const third = await plan('15-09-2026-ssl-ib-3.pdf');
    const [seminar] = summarizeSubjects(third.blocks).filter(
      (subject) => subject.subject === "Bachelor's Seminar",
    );

    expect(seminar?.groups).toEqual([
      'Babula (Dr Elżbieta)',
      'Bąk (Prof. dr h Monika), Rościszewski-Dodgson (Mgr Michael)',
      'Jażdżewska-Gutta (Dr Magdalena)',
      'Krzemiński (Dr Maciej)',
      'Mrzygłód (Dr Urszula)',
      'Olechnowicz-Szewczyk (Dr Agata)',
      'Szmelter-Jarosz (Dr Agnieszka)',
    ]);
  });

  it('rejects files that are not UG plans', async () => {
    await expect(
      readUgPlan(
        new Uint8Array(
          await readFile(join(plans, '260922_Farmacja_rok5_sem9.xlsx')),
        ),
      ),
    ).rejects.toBeInstanceOf(UgPlanError);
  });
});

describe('importing a UG plan', () => {
  const weeks = calendarWeeks(ug, 'winter');

  async function importFor(
    name: string,
    choose: (selection: ImportSelection) => ImportSelection,
  ) {
    const { blocks } = await plan(name);
    const selection = choose(defaultSelection(summarizeSubjects(blocks)));
    return buildImportCandidates(blocks, {
      weekDate: (week, weekday) => weeks?.weekDates(week, weekday)[0] ?? null,
      weekDates: weeks?.weekDates,
      weekCount: weeks?.weekCount,
      dayPlans: ug.dayPlans,
      selection,
      colorFor: () => '#25745b',
    });
  }

  function datesOf(event: Event | null | undefined, from: string, to: string) {
    return event
      ? expandOccurrences(
          event,
          { startDate: from, endDate: to },
          semester,
        ).map((occurrence) => `${occurrence.date} ${occurrence.event.room}`)
      : [];
  }

  it('dates the classes of the chosen group by UG weeks', async () => {
    const candidates = await importFor('15-09-2026-ssl-ek-1.pdf', (selection) =>
      Object.fromEntries(
        Object.entries(selection).map(([key, choice]) => [
          key,
          { ...choice, group: key.endsWith('|cwiczenia') ? 'B' : choice.group },
        ]),
      ),
    );
    const find = (subject: string) =>
      candidates.find((candidate) => candidate.subject === subject);

    // Wednesday, "I tydzień": odd calendar weeks, from week 3.
    expect(
      datesOf(
        find('Własność intelektualna')?.event,
        '2026-10-01',
        '2026-11-30',
      ),
    ).toEqual(['2026-10-14 Aula D', '2026-10-28 Aula D', '2026-11-25 Aula D']);
    // 11.11 is a day off, so week 7 has no class.
    expect(find('Spotkanie Prodziekana ze studentami I roku')).toMatchObject({
      teacher: 'Reszka (Prof. dr Leszek)',
      event: expect.objectContaining({
        recurrence: expect.objectContaining({
          startDate: '2026-10-05',
          endDate: '2026-10-05',
        }),
      }),
    });
    expect(
      datesOf(find('Blok projektowy')?.event, '2026-10-01', '2026-10-31'),
    ).toEqual(['2026-10-09 Aula O', '2026-10-23 C301']);
    expect(
      candidates.filter((candidate) => candidate.subject === 'Makroekonomia I'),
    ).toEqual([
      expect.objectContaining({ classType: 'wyklad', group: null }),
      expect.objectContaining({ classType: 'cwiczenia', group: 'B' }),
    ]);
    expect(
      candidates.some(
        (candidate) => candidate.subject === 'Blok języków obcych',
      ),
    ).toBe(false);
  });

  it('keeps the rhythm through the break and follows day swaps', async () => {
    const candidates = await importFor('15-09-2026-ssl-ib-3.pdf', (selection) =>
      Object.fromEntries(
        Object.entries(selection).map(([key, choice]) => [
          key,
          {
            ...choice,
            group: key.startsWith("bachelor's seminar")
              ? 'Krzemiński (Dr Maciej)'
              : choice.group,
          },
        ]),
      ),
    );
    const seminar = candidates.find(
      (candidate) => candidate.subject === "Bachelor's Seminar",
    );

    expect(
      candidates.filter((c) => c.subject === "Bachelor's Seminar"),
    ).toHaveLength(1);
    expect(seminar?.parity).toBe('even');
    expect(
      datesOf(seminar?.event, '2026-12-01', '2027-01-31').map((date) =>
        date.slice(0, 10),
      ),
    ).toEqual(['2026-12-14', '2027-01-11', '2027-01-25', '2027-01-28']);
  });
});
