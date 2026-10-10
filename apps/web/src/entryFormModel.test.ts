import { describe, expect, it } from 'vitest';
import { EventSchema, classesOn } from '@mruos/shared';
import type { EventSeries } from '@mruos/shared';
import {
  buildAssessment,
  buildNote,
  changeAssessmentKind,
  changeAssessmentSubject,
  countdownLabel,
  createAssessmentDraft,
  createNoteDraft,
  orphanCountLabel,
} from './entryFormModel';

const series: EventSeries[] = [
  {
    id: 'maths',
    event: EventSchema.parse({
      kind: 'class',
      subject: 'Matematyka',
      classType: 'cwiczenia',
      color: '#3b82f6',
      building: 'Wydział Matematyki',
      room: '204',
      startTime: '08:00',
      endTime: '09:30',
      timezone: 'Europe/Warsaw',
      recurrence: {
        freq: 'WEEKLY',
        interval: 1,
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2027-01-25',
      },
      exceptions: [],
    }),
  },
];
const semester = { daysOff: [] };
const monday = '2026-10-12';
const mondayClasses = classesOn(series, monday, semester);
const [mathsClass] = mondayClasses;

describe('assessment drafts', () => {
  it('start during the class they were opened from', () => {
    const draft = createAssessmentDraft(
      'exam',
      { date: monday, dated: mathsClass },
      series,
    );

    expect(draft).toMatchObject({
      kind: 'exam',
      title: 'Egzamin',
      subject: 'Matematyka',
      placement: 'class',
      classSlot: 'cwiczenia|08:00',
      reminders: ['P7D', 'P1D'],
    });
  });

  it('suggest the subject’s room for an exam at its own time', () => {
    const draft = createAssessmentDraft(
      'exam',
      { date: '2027-02-08', subject: 'Matematyka' },
      series,
    );

    expect(draft).toMatchObject({
      placement: 'own',
      building: 'Wydział Matematyki',
      room: '204',
    });
  });

  it('let the default title and reminders follow the kind', () => {
    const draft = createAssessmentDraft('test', { date: monday }, series);

    expect(changeAssessmentKind(draft, 'exam')).toMatchObject({
      title: 'Egzamin',
      reminders: ['P7D', 'P1D'],
    });
    expect(
      changeAssessmentKind(
        { ...draft, title: 'Wejściówka', reminders: ['PT2H'] },
        'exam',
      ),
    ).toMatchObject({ title: 'Wejściówka', reminders: ['PT2H'] });
  });
});

describe('changeAssessmentSubject', () => {
  it('suggests the new subject’s place unless one was typed', () => {
    const draft = createAssessmentDraft('exam', { date: monday }, series);

    expect(changeAssessmentSubject(draft, 'Matematyka', series)).toMatchObject({
      building: 'Wydział Matematyki',
      room: '204',
    });
    expect(
      changeAssessmentSubject({ ...draft, room: 'Aula' }, 'Matematyka', series),
    ).toMatchObject({ building: '', room: 'Aula' });
  });
});

describe('buildAssessment', () => {
  it('pins a kolokwium to the chosen class', () => {
    const draft = createAssessmentDraft(
      'test',
      { date: monday, dated: mathsClass },
      series,
    );

    expect(buildAssessment(draft, mondayClasses)).toEqual({
      success: true,
      value: {
        kind: 'test',
        subject: 'Matematyka',
        title: 'Kolokwium',
        reminders: ['P1D'],
        anchor: {
          type: 'class',
          classType: 'cwiczenia',
          date: monday,
          startTime: '08:00',
        },
      },
    });
  });

  it('saves an own time and leaves out an empty place', () => {
    const draft = {
      ...createAssessmentDraft('exam', { date: '2027-02-08' }, series),
      subject: 'Chemia',
      startTime: '12:00',
      endTime: '14:00',
      building: ' ',
      room: 'Aula',
      details: ' Rozdziały 1–4 ',
    };

    expect(buildAssessment(draft, [])).toMatchObject({
      success: true,
      value: {
        details: 'Rozdziały 1–4',
        anchor: {
          type: 'own',
          date: '2027-02-08',
          startTime: '12:00',
          endTime: '14:00',
          room: 'Aula',
        },
      },
    });
  });

  it('uses the own time when the subject has no class that day', () => {
    const draft = createAssessmentDraft(
      'test',
      { date: '2026-10-13', subject: 'Matematyka' },
      series,
    );

    expect(buildAssessment(draft, [])).toMatchObject({
      success: true,
      value: { anchor: { type: 'own', date: '2026-10-13' } },
    });
  });

  it('explains what is missing', () => {
    const draft = {
      ...createAssessmentDraft('exam', { date: '' }, series),
      title: ' ',
      startTime: '10:00',
      endTime: '09:00',
    };

    expect(buildAssessment(draft, [])).toEqual({
      success: false,
      errors: [
        'Podaj przedmiot.',
        'Podaj tytuł, np. „Kolokwium”.',
        'Podaj datę.',
        'Koniec musi być później niż początek.',
      ],
    });
  });
});

describe('buildNote', () => {
  it('pins a note to a class or to the whole subject', () => {
    const draft = {
      ...createNoteDraft({ date: monday, dated: mathsClass }),
      text: 'Przynieść kalkulator',
    };

    expect(buildNote(draft, mondayClasses)).toMatchObject({
      success: true,
      value: { anchor: { type: 'class', date: monday, startTime: '08:00' } },
    });
    expect(
      buildNote({ ...draft, target: 'subject' }, mondayClasses),
    ).toMatchObject({ success: true, value: { anchor: { type: 'subject' } } });
  });

  it('needs text and, for a class, a class that day', () => {
    const draft = createNoteDraft({ date: '2026-10-13', subject: 'Fizyka' });

    expect(buildNote(draft, [])).toEqual({
      success: false,
      errors: [
        'Wpisz treść notatki.',
        'Tego dnia nie ma zajęć z tego przedmiotu. Wybierz inny dzień albo „Cały przedmiot”.',
      ],
    });
  });
});

describe('countdownLabel', () => {
  it('counts the days in Polish', () => {
    expect([0, 1, 2, 14].map(countdownLabel)).toEqual([
      'dziś',
      'jutro',
      'za 2 dni',
      'za 14 dni',
    ]);
  });
});

describe('orphanCountLabel', () => {
  it('uses the Polish plural', () => {
    expect([1, 2, 4, 5, 12, 22, 25].map(orphanCountLabel)).toEqual([
      '1 wpis bez terminu',
      '2 wpisy bez terminu',
      '4 wpisy bez terminu',
      '5 wpisów bez terminu',
      '12 wpisów bez terminu',
      '22 wpisy bez terminu',
      '25 wpisów bez terminu',
    ]);
  });
});
