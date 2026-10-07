import {
  AssessmentSchema,
  NoteSchema,
  assessmentKindLabels,
  assessmentKindMarks,
  classAnchor,
  minutesLater,
  noteMark,
} from '@mruos/shared';
import type {
  Assessment,
  AssessmentKind,
  ClassAnchor,
  DatedClass,
  Entry,
  EventSeries,
  Note,
  Reminder,
} from '@mruos/shared';
import { classTypeLabels } from './eventFormModel';

// Shared with the calendar files built in @mruos/shared.
export { assessmentKindLabels, assessmentKindMarks, noteMark };

export function entryMark(entry: Entry): string {
  return entry.kind === 'note' ? noteMark : assessmentKindMarks[entry.kind];
}

/** "Kolokwium", "Egzamin poprawkowy" or "Notatka do przedmiotu". */
export function entryTitle(entry: Entry): string {
  if (entry.kind !== 'note') {
    return entry.title;
  }
  return entry.anchor.type === 'subject' ? 'Notatka do przedmiotu' : 'Notatka';
}

const dayFormat = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Warsaw',
});

/** E.g. "pon., 8 lut" for the upcoming list. */
export function dayLabel(start: Date): string {
  return dayFormat.format(start);
}

export const reminders: Reminder[] = ['P7D', 'P1D', 'PT2H'];

export const reminderLabels: Record<Reminder, string> = {
  P7D: 'Tydzień wcześniej',
  P1D: 'Dzień wcześniej',
  PT2H: '2 godziny wcześniej',
};

export function defaultReminders(kind: AssessmentKind): Reminder[] {
  return kind === 'exam' ? ['P7D', 'P1D'] : ['P1D'];
}

/** "dziś", "jutro" or "za 5 dni". */
export function countdownLabel(daysLeft: number): string {
  if (daysLeft === 0) {
    return 'dziś';
  }
  return daysLeft === 1 ? 'jutro' : `za ${daysLeft} dni`;
}

/** Tells apart classes of a subject on one day in a form select. */
export function classSlotValue(anchor: ClassAnchor): string {
  return `${anchor.classType}|${anchor.startTime}`;
}

export function classSlotLabel(dated: DatedClass): string {
  return `${classTypeLabels[dated.event.classType]} ${dated.event.startTime}–${dated.event.endTime}, sala ${dated.event.room}`;
}

/** The building and room where the subject usually takes place. */
export function subjectPlace(
  series: readonly EventSeries[],
  subject: string,
): { building: string; room: string } | undefined {
  const match = series.find(({ event }) => event.subject === subject.trim());
  return match
    ? { building: match.event.building, room: match.event.room }
    : undefined;
}

/** The context an entry form opens in: a class, or only a date. */
export type EntryContext = {
  date: string;
  subject?: string;
  dated?: DatedClass;
};

export type Placement = 'class' | 'own';

export type AssessmentDraft = {
  kind: AssessmentKind;
  title: string;
  subject: string;
  date: string;
  placement: Placement;
  classSlot: string;
  startTime: string;
  endTime: string;
  building: string;
  room: string;
  details: string;
  reminders: Reminder[];
};

export function createAssessmentDraft(
  kind: AssessmentKind,
  context: EntryContext,
  series: readonly EventSeries[],
  initial?: Assessment,
): AssessmentDraft {
  if (initial) {
    const { anchor } = initial;
    const own = anchor.type === 'own' ? anchor : undefined;
    const place = subjectPlace(series, initial.subject);

    return {
      kind: initial.kind,
      title: initial.title,
      subject: initial.subject,
      date: anchor.date,
      placement: anchor.type,
      classSlot: anchor.type === 'class' ? classSlotValue(anchor) : '',
      startTime: anchor.startTime,
      endTime: own?.endTime ?? minutesLater(anchor.startTime, 90),
      building: own ? (own.building ?? '') : (place?.building ?? ''),
      room: own ? (own.room ?? '') : (place?.room ?? ''),
      details: initial.details ?? '',
      reminders: initial.reminders,
    };
  }

  const { dated } = context;
  const subject = dated?.event.subject ?? context.subject ?? '';
  const place = dated?.event ?? subjectPlace(series, subject);

  return {
    kind,
    title: assessmentKindLabels[kind],
    subject,
    date: context.date,
    // From a class it happens there; otherwise a kolokwium usually happens
    // during a class and an exam at its own time.
    placement: dated || kind === 'test' ? 'class' : 'own',
    classSlot: dated ? classSlotValue(classAnchor(dated)) : '',
    startTime: dated?.event.startTime ?? '09:00',
    endTime: dated?.event.endTime ?? '10:30',
    building: place?.building ?? '',
    room: place?.room ?? '',
    details: '',
    reminders: defaultReminders(kind),
  };
}

/** Switches the kind; a title and reminders left at their defaults follow. */
export function changeAssessmentKind(
  draft: AssessmentDraft,
  kind: AssessmentKind,
): AssessmentDraft {
  const sameReminders = (left: Reminder[], right: Reminder[]) =>
    left.length === right.length &&
    left.every((reminder) => right.includes(reminder));

  return {
    ...draft,
    kind,
    title:
      draft.title === assessmentKindLabels[draft.kind]
        ? assessmentKindLabels[kind]
        : draft.title,
    reminders: sameReminders(draft.reminders, defaultReminders(draft.kind))
      ? defaultReminders(kind)
      : draft.reminders,
  };
}

/**
 * Changes the subject; a place left empty or at the old subject's usual
 * place follows the new subject.
 */
export function changeAssessmentSubject(
  draft: AssessmentDraft,
  subject: string,
  series: readonly EventSeries[],
): AssessmentDraft {
  const previous = subjectPlace(series, draft.subject);
  const suggested =
    (!draft.building && !draft.room) ||
    (draft.building === previous?.building && draft.room === previous.room);
  const next = subjectPlace(series, subject);

  return {
    ...draft,
    subject,
    ...(suggested
      ? { building: next?.building ?? '', room: next?.room ?? '' }
      : {}),
  };
}

/** The chosen class among the subject's classes that day, if any. */
export function chosenClass(
  classSlot: string,
  options: readonly DatedClass[],
): DatedClass | undefined {
  return (
    options.find((dated) => classSlotValue(classAnchor(dated)) === classSlot) ??
    options[0]
  );
}

/** "During a class" needs a class of the subject on that day. */
export function effectivePlacement(
  placement: Placement,
  options: readonly DatedClass[],
): Placement {
  return placement === 'class' && options.length > 0 ? 'class' : 'own';
}

export type EntryFormResult<Value> =
  { success: true; value: Value } | { success: false; errors: string[] };

const isTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
// Date inputs give either a valid date or an empty value.
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function buildAssessment(
  draft: AssessmentDraft,
  options: readonly DatedClass[],
): EntryFormResult<Assessment> {
  const errors: string[] = [];
  const subject = draft.subject.trim();
  const title = draft.title.trim();
  const details = draft.details.trim();
  const building = draft.building.trim();
  const room = draft.room.trim();

  if (!subject) {
    errors.push('Podaj przedmiot.');
  }
  if (!title) {
    errors.push('Podaj tytuł, np. „Kolokwium”.');
  }
  if (!isDate(draft.date)) {
    errors.push('Podaj datę.');
  }

  let anchor: Assessment['anchor'] | undefined;
  const dated = chosenClass(draft.classSlot, options);
  if (effectivePlacement(draft.placement, options) === 'class' && dated) {
    anchor = classAnchor(dated);
  } else if (!isTime(draft.startTime) || !isTime(draft.endTime)) {
    errors.push('Podaj godziny rozpoczęcia i zakończenia.');
  } else if (draft.endTime <= draft.startTime) {
    errors.push('Koniec musi być później niż początek.');
  } else {
    anchor = {
      type: 'own',
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      ...(building ? { building } : {}),
      ...(room ? { room } : {}),
    };
  }

  if (errors.length > 0 || !anchor) {
    return { success: false, errors };
  }

  const parsed = AssessmentSchema.safeParse({
    kind: draft.kind,
    subject,
    title,
    ...(details ? { details } : {}),
    reminders: draft.reminders,
    anchor,
  });

  return parsed.success
    ? { success: true, value: parsed.data }
    : { success: false, errors: ['Sprawdź długość wpisanych tekstów.'] };
}

export type NoteTarget = 'class' | 'subject';

export type NoteDraft = {
  subject: string;
  target: NoteTarget;
  date: string;
  classSlot: string;
  text: string;
};

export function createNoteDraft(
  context: EntryContext,
  initial?: Note,
): NoteDraft {
  if (initial) {
    const { anchor } = initial;
    return {
      subject: initial.subject,
      target: anchor.type,
      date: anchor.type === 'class' ? anchor.date : context.date,
      classSlot: anchor.type === 'class' ? classSlotValue(anchor) : '',
      text: initial.text,
    };
  }

  const { dated } = context;
  return {
    subject: dated?.event.subject ?? context.subject ?? '',
    target: 'class',
    date: context.date,
    classSlot: dated ? classSlotValue(classAnchor(dated)) : '',
    text: '',
  };
}

export function buildNote(
  draft: NoteDraft,
  options: readonly DatedClass[],
): EntryFormResult<Note> {
  const errors: string[] = [];
  const subject = draft.subject.trim();
  const text = draft.text.trim();
  const dated = chosenClass(draft.classSlot, options);

  if (!subject) {
    errors.push('Podaj przedmiot.');
  }
  if (!text) {
    errors.push('Wpisz treść notatki.');
  }
  if (draft.target === 'class' && !dated) {
    errors.push(
      'Tego dnia nie ma zajęć z tego przedmiotu. Wybierz inny dzień albo „Cały przedmiot”.',
    );
  }
  if (errors.length > 0) {
    return { success: false, errors };
  }

  const parsed = NoteSchema.safeParse({
    kind: 'note',
    subject,
    text,
    anchor:
      draft.target === 'class' && dated
        ? classAnchor(dated)
        : { type: 'subject' },
  });

  return parsed.success
    ? { success: true, value: parsed.data }
    : { success: false, errors: ['Notatka może mieć najwyżej 2000 znaków.'] };
}
