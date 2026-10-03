import { describe, expect, it } from 'vitest';
import {
  displaySubject,
  parseScheduleBlock,
  parseWeekList,
} from './scheduleBlock.js';
import type { Weekday } from './types.js';

// Block texts copied from real faculty timetables (CM UMK, 2026/27).
function parse(text: string, weekday: Weekday | null = 'MO') {
  return parseScheduleBlock({ id: 'block', text, weekday });
}

describe('parseWeekList', () => {
  it('reads ranges and lists of semester weeks', () => {
    expect(parseWeekList('1-15')).toHaveLength(15);
    expect(parseWeekList('1,5-10')).toEqual([1, 5, 6, 7, 8, 9, 10]);
    expect(parseWeekList('4,7')).toEqual([4, 7]);
    expect(parseWeekList(' 1, 2, 3 ')).toEqual([1, 2, 3]);
  });
});

describe('parseScheduleBlock', () => {
  it('reads a lecture with its time, weeks and location', () => {
    const block = parse(
      'PODSTAWY ALERGOLOGII\n(WYKŁAD)\n08.00-09.30   (tydz.11-15)\n31/ Skłodowskiej 9\n',
    );

    expect(block).toMatchObject({
      subject: 'PODSTAWY ALERGOLOGII',
      classType: 'wyklad',
      elective: false,
      room: '31',
      building: 'Skłodowskiej 9',
      issues: [],
    });
    expect(block.sessions).toEqual([
      {
        startTime: '08:00',
        endTime: '09:30',
        weeks: [11, 12, 13, 14, 15],
        groups: [],
      },
    ]);
  });

  it('reads a laboratory group from the subject line', () => {
    const block = parse(
      'Kosmetologia ciała - lab.  gr. 1\n07.00-11.30   (tydz.1-15)\nsala 5/ Jagiellońska 15',
    );

    expect(block).toMatchObject({
      subject: 'Kosmetologia ciała',
      classType: 'laboratorium',
      room: '5',
      building: 'Jagiellońska 15',
      issues: [],
    });
    expect(block.sessions[0]?.groups).toEqual(['1']);
  });

  it('splits several groups and keeps primes in group names', () => {
    const block = parse(
      "Farmacja praktyczna - lab.  gr.  a',b'\n08.00-11.45    (tydz.1-9)\n09.30-11.45    (tydz.10)",
    );

    expect(block.sessions).toEqual([
      {
        startTime: '08:00',
        endTime: '11:45',
        weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        groups: ["a'", "b'"],
      },
      {
        startTime: '09:30',
        endTime: '11:45',
        weeks: [10],
        groups: ["a'", "b'"],
      },
    ]);
  });

  it('assigns different weeks to each group of one block', () => {
    const block = parse(
      "Biofarmacja lab.   07.30-11.15\ngr. e'  (tydz.1-10)\ngr. f'  (tydz.6-15)",
    );

    expect(block.subject).toBe('Biofarmacja');
    expect(block.sessions.map(({ groups, weeks }) => [groups, weeks])).toEqual([
      [["e'"], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      [["f'"], [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
    ]);
    expect(block.sessions[1]?.startTime).toBe('07:30');
  });

  it('reads group rotations written as week and group pairs', () => {
    const block = parse(
      'Farmakoterapia i inf. o lekach zp.  08.00-10.15\ntydz.3 - gr. GH\ttydz.4 - gr. GH\ntydz.5 - gr. IJ\ttydz.6 - gr. IJ\nKat. Kardiologii i Farmakologii Klinicznej',
    );

    expect(block.classType).toBe('zajecia-praktyczne');
    expect(block.subject).toBe('Farmakoterapia i inf. o lekach');
    expect(block.sessions.map(({ groups, weeks }) => [groups, weeks])).toEqual([
      [['GH'], [3]],
      [['GH'], [4]],
      [['IJ'], [5]],
      [['IJ'], [6]],
    ]);
    expect(block.building).toBe('Kat. Kardiologii i Farmakologii Klinicznej');
    expect(block.issues).toEqual([{ code: 'missing-room' }]);
  });

  it('reads the group and time written on the subject line', () => {
    const block = parse(
      'Farmakoterapia i informacja o lekach ćw.  gr. 3 16.00-18.15   (tydz.5-14)\nsala 115/ Kat. Farmakodynamiki',
    );

    expect(block).toMatchObject({
      subject: 'Farmakoterapia i informacja o lekach',
      classType: 'cwiczenia',
      room: '115',
      building: 'Kat. Farmakodynamiki',
    });
    expect(block.sessions).toEqual([
      {
        startTime: '16:00',
        endTime: '18:15',
        weeks: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        groups: ['3'],
      },
    ]);
  });

  it('reads a one-day room change', () => {
    const block = parse(
      'Etyka zawodu ćw.  gr.  3\n12.00-13.30   (tydz.11-15)\n-1.5/ Jagiellońska 13, wyj. 2.02. - -1.2/ Jagiellońska 13',
    );

    expect(block.room).toBe('-1.5');
    expect(block.building).toBe('Jagiellońska 13');
    expect(block.roomChanges).toEqual([
      { day: 2, month: 2, room: '-1.2', building: 'Jagiellońska 13' },
    ]);
  });

  it('marks remote classes and electives', () => {
    expect(
      parse(
        'FARMAKOEPIDEMIOLOGIA  (WYKŁAD)\n16.00-19.00   (tydz.10-14)\nZDALNIE',
      ),
    ).toMatchObject({ remote: true, room: null, issues: [] });
    expect(
      parse(
        'PRZEDSIĘBIORCZOŚĆ W KOSMETOLOGII / TOKSYKOLOGIA KOSMETYKU\n(WYKŁAD DO WYBORU)\n08.00-09.30   (tydz.6-10)\n11/ Patomorfologia',
      ),
    ).toMatchObject({
      subject: 'PRZEDSIĘBIORCZOŚĆ W KOSMETOLOGII / TOKSYKOLOGIA KOSMETYKU',
      classType: 'wyklad',
      elective: true,
      room: '11',
    });
  });

  it('reports what could not be read instead of guessing', () => {
    const block = parse(
      'Technologia postaci leku III    lab.  gr. f\n07.30-11.15  (tydz.1-6)',
      null,
    );

    expect(block.subject).toBe('Technologia postaci leku III');
    expect(block.issues.map((issue) => issue.code)).toEqual([
      'missing-weekday',
      'missing-room',
      'missing-building',
    ]);
    expect(parse('Konsultacje\n10.00-11.00\ns. 12')).toMatchObject({
      room: '12',
      issues: [
        { code: 'missing-type' },
        { code: 'missing-weeks' },
        { code: 'missing-building' },
      ],
    });
    expect(
      parse('Konsultacje ćw.\nprzynieść fartuch\n10.00-11.00 (tydz.1)\n12/ A')
        .issues,
    ).toEqual([{ code: 'unparsed-text', detail: 'przynieść fartuch' }]);
  });
});

describe('displaySubject', () => {
  it('turns capitalised names into sentence case only', () => {
    expect(displaySubject('PODSTAWY ALERGOLOGII')).toBe('Podstawy alergologii');
    expect(displaySubject('Kosmetologia z elementami SPA')).toBe(
      'Kosmetologia z elementami SPA',
    );
  });
});
