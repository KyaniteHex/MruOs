import { DateTime } from 'luxon';
import { displaySubject } from './scheduleBlock.js';
import type { BlockIssueCode, ParsedBlock } from './scheduleBlock.js';
import { EventSchema } from './schemas.js';
import { semesterWeekRange } from './semester.js';
import type {
  ClassType,
  Event,
  EventException,
  Semester,
  Weekday,
} from './types.js';

// Turns parsed timetable blocks into class series for the chosen groups.
// Every block that cannot become a valid series is still returned as a
// candidate with issues, so the preview can point at what needs fixing.

export type ImportSubject = {
  key: string;
  subject: string;
  classType: ClassType | null;
  /** Group names that appear in this subject's sessions. */
  groups: string[];
  elective: boolean;
};

export type SubjectChoice = { include: boolean; group: string | null };
export type ImportSelection = Record<string, SubjectChoice>;

export type ImportIssueCode =
  BlockIssueCode | 'invalid-event' | 'room-change-unmatched';

export type ImportIssue = { code: ImportIssueCode; detail?: string };

export type ImportCandidate = {
  id: string;
  blockId: string;
  subjectKey: string;
  subject: string;
  classType: ClassType | null;
  weekday: Weekday | null;
  startTime: string | null;
  endTime: string | null;
  weeks: number[];
  group: string | null;
  room: string;
  building: string;
  /** Null when the block lacks data needed to create a series. */
  event: Event | null;
  issues: ImportIssue[];
};

export type ImportOptions = {
  semester: Pick<Semester, 'startDate'> & Partial<Pick<Semester, 'daysOff'>>;
  selection: ImportSelection;
  colorFor: (classType: ClassType) => string;
  /** Subject names written elsewhere in the sheet, used for nicer casing. */
  knownSubjects?: readonly string[];
};

const weekdayNumbers: Record<Weekday, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

const missingValue = '?';
const remoteRoom = 'online';
const remoteBuilding = 'Zajęcia zdalne';

function normalizeName(subject: string): string {
  return subject.toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ').trim();
}

export function subjectKey(block: ParsedBlock): string {
  return `${normalizeName(block.subject)}|${block.classType ?? ''}`;
}

function preferredNames(
  blocks: readonly ParsedBlock[],
  knownSubjects: readonly string[],
): Map<string, string> {
  const names = new Map<string, string>();

  const hasLowercase = (name: string) => /\p{Ll}/u.test(name);

  for (const name of [...knownSubjects, ...blocks.map((b) => b.subject)]) {
    const key = normalizeName(name);
    const current = names.get(key);
    // Mixed case beats names written entirely in capitals.
    if (key && (!current || (!hasLowercase(current) && hasLowercase(name)))) {
      names.set(key, name.trim());
    }
  }

  return names;
}

export function summarizeSubjects(
  blocks: readonly ParsedBlock[],
  knownSubjects: readonly string[] = [],
): ImportSubject[] {
  const names = preferredNames(blocks, knownSubjects);
  const subjects = new Map<string, ImportSubject>();

  for (const block of blocks) {
    const key = subjectKey(block);
    const subject = subjects.get(key) ?? {
      key,
      subject: displaySubject(
        names.get(normalizeName(block.subject)) ?? block.subject,
      ),
      classType: block.classType,
      groups: [],
      elective: false,
    };
    const groups = new Set(subject.groups);
    block.sessions.forEach((session) =>
      session.groups.forEach((group) => groups.add(group)),
    );
    subjects.set(key, {
      ...subject,
      groups: [...groups].sort((left, right) =>
        left.localeCompare(right, 'pl', { numeric: true }),
      ),
      elective: subject.elective || block.elective,
    });
  }

  return [...subjects.values()].sort((left, right) =>
    left.subject.localeCompare(right.subject, 'pl'),
  );
}

export function defaultSelection(
  subjects: readonly ImportSubject[],
): ImportSelection {
  return Object.fromEntries(
    subjects.map((subject) => [
      subject.key,
      {
        include: !subject.elective,
        group: subject.groups.length === 1 ? (subject.groups[0] ?? null) : null,
      },
    ]),
  );
}

function classDate(
  semester: ImportOptions['semester'],
  week: number,
  weekday: Weekday,
): DateTime {
  const window = DateTime.fromISO(semesterWeekRange(semester, week).startDate, {
    zone: 'Europe/Warsaw',
  });

  return window.plus({
    days: (weekdayNumbers[weekday] - window.weekday + 7) % 7,
  });
}

function buildEvent(
  base: Omit<ImportCandidate, 'event' | 'issues' | 'id'>,
  block: ParsedBlock,
  options: ImportOptions,
  issues: ImportIssue[],
): Event | null {
  const { weekday, startTime, endTime, weeks } = base;
  if (!weekday || !startTime || !endTime || weeks.length === 0) {
    return null;
  }

  const first = weeks[0] ?? 1;
  const last = weeks[weeks.length - 1] ?? first;
  const dates = new Map<number, DateTime>();
  for (let week = first; week <= last; week += 1) {
    dates.set(week, classDate(options.semester, week, weekday));
  }

  const exceptions: EventException[] = [];
  for (const [week, date] of dates) {
    if (!weeks.includes(week)) {
      exceptions.push({ date: date.toISODate() ?? '', status: 'cancelled' });
    }
  }
  for (const change of block.roomChanges) {
    const match = weeks
      .map((week) => dates.get(week))
      .find((date) => date?.day === change.day && date.month === change.month);
    if (!match) {
      issues.push({
        code: 'room-change-unmatched',
        detail: `${change.day}.${String(change.month).padStart(2, '0')}`,
      });
      continue;
    }
    exceptions.push({
      date: match.toISODate() ?? '',
      override: {
        room: change.room,
        ...(change.building ? { building: change.building } : {}),
      },
    });
  }

  const classType = base.classType ?? 'cwiczenia';
  const parsed = EventSchema.safeParse({
    kind: 'class',
    subject: base.subject || missingValue,
    classType,
    color: options.colorFor(classType),
    building: base.building,
    room: base.room,
    startTime,
    endTime,
    timezone: 'Europe/Warsaw',
    recurrence: {
      freq: 'WEEKLY',
      interval: 1,
      byDay: [weekday],
      startDate: dates.get(first)?.toISODate(),
      endDate: dates.get(last)?.toISODate(),
    },
    exceptions,
  });

  if (!parsed.success) {
    issues.push({ code: 'invalid-event' });
    return null;
  }

  return parsed.data;
}

export function buildImportCandidates(
  blocks: readonly ParsedBlock[],
  options: ImportOptions,
): ImportCandidate[] {
  const subjects = new Map(
    summarizeSubjects(blocks, options.knownSubjects).map((subject) => [
      subject.key,
      subject,
    ]),
  );
  const fallbackSelection = defaultSelection([...subjects.values()]);
  const candidates: ImportCandidate[] = [];

  for (const block of blocks) {
    const key = subjectKey(block);
    const choice = options.selection[key] ?? fallbackSelection[key];
    if (!choice?.include) {
      continue;
    }

    // Sessions for everyone or for the chosen group, merged by time so a
    // group rotation becomes one series with several weeks.
    const merged = new Map<
      string,
      { startTime: string | null; endTime: string | null; weeks: Set<number> }
    >();
    const sessions =
      block.sessions.length > 0
        ? block.sessions
        : [{ startTime: null, endTime: null, weeks: [], groups: [] }];
    for (const session of sessions) {
      const forStudent =
        session.groups.length === 0 ||
        (choice.group !== null && session.groups.includes(choice.group));
      if (!forStudent) {
        continue;
      }
      const timeKey = `${session.startTime}-${session.endTime}`;
      const entry = merged.get(timeKey) ?? {
        startTime: session.startTime,
        endTime: session.endTime,
        weeks: new Set<number>(),
      };
      session.weeks.forEach((week) => entry.weeks.add(week));
      merged.set(timeKey, entry);
    }

    [...merged.values()].forEach((session, index) => {
      const issues: ImportIssue[] = [...block.issues];
      const base = {
        blockId: block.id,
        subjectKey: key,
        subject: subjects.get(key)?.subject ?? block.subject,
        classType: block.classType,
        weekday: block.weekday,
        startTime: session.startTime,
        endTime: session.endTime,
        weeks: [...session.weeks].sort((left, right) => left - right),
        group: block.sessions.some((s) => s.groups.length > 0)
          ? choice.group
          : null,
        room: block.remote ? remoteRoom : (block.room ?? missingValue),
        building: block.remote
          ? remoteBuilding
          : (block.building ?? missingValue),
      };
      const event = buildEvent(base, block, options, issues);
      candidates.push({ ...base, id: `${block.id}:${index}`, event, issues });
    });
  }

  return candidates.sort(
    (left, right) =>
      (left.weekday ? weekdayNumbers[left.weekday] : 8) -
        (right.weekday ? weekdayNumbers[right.weekday] : 8) ||
      (left.startTime ?? '').localeCompare(right.startTime ?? ''),
  );
}
