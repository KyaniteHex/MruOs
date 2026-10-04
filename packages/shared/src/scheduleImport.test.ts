import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { academicWeekCalendar, semesterWeekCalendar } from './academicYear.js';
import { parseScheduleBlock } from './scheduleBlock.js';
import {
  buildImportCandidates,
  defaultSelection,
  summarizeSubjects,
} from './scheduleImport.js';
import type { ImportSelection } from './scheduleImport.js';
import type { AcademicYear, Weekday } from './types.js';

const semester = { startDate: '2026-10-05' };
const colorFor = () => '#25745b';

function block(id: string, text: string, weekday: Weekday | null = 'MO') {
  return parseScheduleBlock({ id, text, weekday });
}

function build(
  blocks: ReturnType<typeof block>[],
  selection: ImportSelection = {},
  options: { daysOff?: string[]; knownSubjects?: string[] } = {},
) {
  return buildImportCandidates(blocks, {
    weekDate: semesterWeekCalendar({
      ...semester,
      daysOff: options.daysOff ?? [],
    }),
    selection,
    colorFor,
    knownSubjects: options.knownSubjects,
  });
}

function weekdaysBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (
    let day = DateTime.fromISO(start);
    day <= DateTime.fromISO(end);
    day = day.plus({ days: 1 })
  ) {
    if (day.weekday <= 5) dates.push(day.toISODate() ?? '');
  }
  return dates;
}

const lecture = block(
  'lecture',
  'PODSTAWY ALERGOLOGII\n(WYKŁAD)\n08.00-09.30   (tydz.11-15)\n31/ Skłodowskiej 9',
);
const biopharmacy = block(
  'lab',
  "Biofarmacja lab.   07.30-11.15\ngr. e'  (tydz.1-10)\ngr. f'  (tydz.6-15)\n12/ Jagiellońska 13",
  'WE',
);

describe('buildImportCandidates', () => {
  it('turns semester weeks into a weekly series on the block weekday', () => {
    const [candidate] = build([lecture]);

    expect(candidate?.issues).toEqual([]);
    expect(candidate?.event).toEqual({
      kind: 'class',
      subject: 'Podstawy alergologii',
      classType: 'wyklad',
      color: '#25745b',
      building: 'Skłodowskiej 9',
      room: '31',
      startTime: '08:00',
      endTime: '09:30',
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO'],
        startDate: '2026-12-14',
        endDate: '2027-01-11',
      },
      exceptions: [],
    });
  });

  it('cancels the weeks missing from a week list', () => {
    const [candidate] = build([
      block(
        'gaps',
        'FARMAKOTERAPIA I INFORMACJA O LEKACH\n(WYKŁAD)\n09.45-11.15   (tydz.1,5-10)\nA019/ Patomorfologia',
        'WE',
      ),
    ]);

    expect(candidate?.event?.recurrence).toMatchObject({
      startDate: '2026-10-07',
      endDate: '2026-12-09',
    });
    expect(candidate?.event?.exceptions).toEqual([
      { date: '2026-10-14', status: 'cancelled' },
      { date: '2026-10-21', status: 'cancelled' },
      { date: '2026-10-28', status: 'cancelled' },
    ]);
  });

  it('imports only the sessions of the chosen group', () => {
    const subjects = summarizeSubjects([biopharmacy]);
    const key = subjects[0]?.key ?? '';

    expect(subjects[0]).toMatchObject({
      subject: 'Biofarmacja',
      groups: ["e'", "f'"],
    });
    expect(defaultSelection(subjects)[key]).toEqual({
      include: true,
      group: null,
    });
    expect(build([biopharmacy])).toEqual([]);

    const [candidate] = build([biopharmacy], {
      [key]: { include: true, group: "f'" },
    });
    expect(candidate).toMatchObject({
      group: "f'",
      weeks: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    });
    expect(candidate?.event?.recurrence.startDate).toBe('2026-11-11');
  });

  it('merges a group rotation into one series', () => {
    const rotation = block(
      'zp',
      'Farmakoterapia i inf. o lekach zp.  08.00-10.15\ntydz.3 - gr. GH\ttydz.4 - gr. GH\ntydz.5 - gr. IJ\ttydz.6 - gr. IJ\nsala 2/ Kat. Kardiologii',
      'TH',
    );
    const key = summarizeSubjects([rotation])[0]?.key ?? '';
    const candidates = build([rotation], {
      [key]: { include: true, group: 'GH' },
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.weeks).toEqual([3, 4]);
    expect(candidates[0]?.event?.classType).toBe('zajecia-praktyczne');
  });

  it('skips electives unless the student picks them', () => {
    const elective = block(
      'elective',
      'PRZEDSIĘBIORCZOŚĆ W KOSMETOLOGII / TOKSYKOLOGIA KOSMETYKU\n(WYKŁAD DO WYBORU)\n08.00-09.30   (tydz.6-10)\n11/ Patomorfologia',
      'TH',
    );
    const key = summarizeSubjects([elective])[0]?.key ?? '';

    expect(build([elective])).toEqual([]);
    expect(
      build([elective], { [key]: { include: true, group: null } }),
    ).toHaveLength(1);
  });

  it('applies a one-day room change in a semester with a winter break', () => {
    const ethics = block(
      'ethics',
      'Etyka zawodu ćw.  gr.  3\n12.00-13.30   (tydz.11-15)\n-1.5/ Jagiellońska 13, wyj. 2.02. - -1.2/ Jagiellońska 13',
      'TU',
    );
    const key = summarizeSubjects([ethics])[0]?.key ?? '';
    const selection = { [key]: { include: true, group: '3' } };

    const [withBreak] = build([ethics], selection, {
      daysOff: weekdaysBetween('2026-12-21', '2027-01-08'),
    });
    expect(withBreak?.event?.recurrence.endDate).toBe('2027-02-02');
    // Weekly dates inside the break are not classes, so they are cancelled.
    expect(withBreak?.event?.exceptions).toEqual([
      { date: '2026-12-22', status: 'cancelled' },
      { date: '2026-12-29', status: 'cancelled' },
      { date: '2027-01-05', status: 'cancelled' },
      {
        date: '2027-02-02',
        override: { room: '-1.2', building: 'Jagiellońska 13' },
      },
    ]);

    const [withoutBreak] = build([ethics], selection);
    expect(withoutBreak?.issues).toEqual([
      { code: 'room-change-unmatched', detail: '2.02' },
    ]);
  });

  it('keeps blocks it cannot turn into a series, with the reasons', () => {
    const [candidate] = build([
      block('broken', 'Konsultacje ćw.\n12/ A', null),
    ]);

    expect(candidate?.event).toBeNull();
    expect(candidate?.issues.map((issue) => issue.code)).toEqual([
      'missing-weekday',
      'missing-time',
      'missing-weeks',
    ]);
  });

  it('uses mixed-case subject names and placeholders for remote classes', () => {
    const remote = block(
      'remote',
      'FARMAKOEPIDEMIOLOGIA  (WYKŁAD)\n16.00-19.00   (tydz.10-14)\nZDALNIE',
    );
    const [candidate] = build(
      [remote],
      {},
      { knownSubjects: ['Farmakoepidemiologia'] },
    );

    expect(candidate).toMatchObject({
      subject: 'Farmakoepidemiologia',
      room: 'online',
      building: 'Zajęcia zdalne',
    });
  });

  it('dates weeks by the teaching periods of an academic calendar', () => {
    const winter: AcademicYear = {
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
              startDate: '2026-10-02',
              endDate: '2026-12-20',
            },
            {
              label: 'Zajęcia dydaktyczne',
              kind: 'teaching',
              startDate: '2027-01-07',
              endDate: '2027-02-04',
            },
          ],
        },
      ],
      daysOff: [],
    };
    const ethics = block(
      'ethics',
      'Etyka zawodu ćw.  gr.  3\n12.00-13.30   (tydz.11-16)\n-1.5/ Jagiellońska 13, wyj. 2.02. - -1.2/ Jagiellońska 13',
      'TU',
    );
    const key = summarizeSubjects([ethics])[0]?.key ?? '';

    const [candidate] = buildImportCandidates([ethics], {
      weekDate: academicWeekCalendar(winter, 'winter'),
      selection: { [key]: { include: true, group: '3' } },
      colorFor,
    });

    expect(candidate?.event?.recurrence).toMatchObject({
      startDate: '2026-12-15',
      endDate: '2027-02-02',
    });
    expect(candidate?.event?.exceptions).toContainEqual({
      date: '2027-02-02',
      override: { room: '-1.2', building: 'Jagiellońska 13' },
    });
    // The winter semester has only 15 teaching Tuesdays.
    expect(candidate?.issues).toEqual([
      { code: 'week-out-of-range', detail: '16' },
    ]);
  });
});
