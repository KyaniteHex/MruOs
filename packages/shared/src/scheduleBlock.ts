import type { ClassType, Weekday } from './types.js';

// Parses the free-text blocks of university timetables drawn as shapes over a
// day × time grid, e.g. "Biofarmacja lab. 07.30-11.15 | gr. e' (tydz.1-10)".
// Each block yields sessions (time, weeks, groups) plus issues that tell the
// user what could not be understood, so nothing is dropped silently.

export type ScheduleBlockInput = {
  id: string;
  text: string;
  weekday: Weekday | null;
};

export type ParsedSession = {
  startTime: string | null;
  endTime: string | null;
  weeks: number[];
  /** Empty when the session is for everyone, e.g. a lecture. */
  groups: string[];
};

export type RoomChange = {
  day: number;
  month: number;
  room: string;
  building: string | null;
};

export type BlockIssueCode =
  | 'missing-subject'
  | 'missing-type'
  | 'missing-weekday'
  | 'missing-time'
  | 'missing-weeks'
  | 'missing-room'
  | 'missing-building'
  | 'unparsed-text';

export type BlockIssue = { code: BlockIssueCode; detail?: string };

export type ParsedBlock = {
  id: string;
  text: string;
  subject: string;
  classType: ClassType | null;
  elective: boolean;
  weekday: Weekday | null;
  sessions: ParsedSession[];
  room: string | null;
  building: string | null;
  remote: boolean;
  roomChanges: RoomChange[];
  issues: BlockIssue[];
};

const letter = 'A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż';
const timeRangePattern = /(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})/;
const weeksPattern =
  /tydz\.?\s*(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)/i;
const groupToken = `[0-9${letter}]+['’]?`;
const groupPattern = new RegExp(
  `gr\\.\\s*(${groupToken}(?:\\s*,\\s*${groupToken})*)`,
);
const roomChangePattern =
  /,?\s*wyj\.\s*(\d{1,2})\.(\d{1,2})\.?\s*[-–]\s*(.+)$/i;
const remotePattern = /^(zdalnie|online)$/i;
const roomOnlyPattern = /^(?:s\.|sala)\s*(\S+)$/i;

const typePatterns: [RegExp, ClassType][] = [
  [/wykład|(?<!\p{L})wyk\./iu, 'wyklad'],
  [/(?<!\p{L})lab\.|laboratorium/iu, 'laboratorium'],
  [/(?<!\p{L})ćw\.|ćwiczenia/iu, 'cwiczenia'],
  [/(?<!\p{L})zp\.|zaj(?:ęcia|\.)\s*prakt/iu, 'zajecia-praktyczne'],
  [/(?<!\p{L})sem\.|seminarium/iu, 'seminarium'],
];

// Markers removed from the first line to leave only the subject name.
const subjectNoise: RegExp[] = [
  /\((?:wykład[^)]*)\)/giu,
  /(?<!\p{L})(?:wykład|lab\.|ćw\.|sem\.|zp\.)/giu,
  new RegExp(groupPattern.source, 'g'),
  new RegExp(timeRangePattern.source, 'g'),
  /\(?\s*tydz\.?[^)]*\)?/gi,
];

function pad(value: string): string {
  return value.padStart(2, '0');
}

function parseTimeRange(segment: string) {
  const match = timeRangePattern.exec(segment);
  if (!match) {
    return null;
  }
  const [, startHour = '', startMinute = '', endHour = '', endMinute = ''] =
    match;

  return {
    startTime: `${pad(startHour)}:${startMinute}`,
    endTime: `${pad(endHour)}:${endMinute}`,
  };
}

export function parseWeekList(source: string): number[] {
  const weeks = new Set<number>();

  for (const part of source.split(',')) {
    const [first, last] = part.split(/[-–]/).map((value) => Number(value));
    if (first === undefined || !Number.isInteger(first) || first < 1) {
      continue;
    }
    const end = last !== undefined && Number.isInteger(last) ? last : first;
    for (let week = first; week <= end; week += 1) {
      weeks.add(week);
    }
  }

  return [...weeks].sort((left, right) => left - right);
}

function parseWeeks(segment: string): number[] | null {
  const match = weeksPattern.exec(segment);

  return match?.[1] ? parseWeekList(match[1]) : null;
}

function parseGroups(segment: string): string[] | null {
  const match = groupPattern.exec(segment);

  return match?.[1]
    ? match[1]
        .split(',')
        .map((group) => group.trim().replace('’', "'"))
        .filter(Boolean)
    : null;
}

function detectClassType(text: string): ClassType | null {
  return typePatterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function cleanSubject(firstLine: string): string {
  let subject = firstLine;
  for (const pattern of subjectNoise) {
    subject = subject.replace(pattern, ' ');
  }

  return subject
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–.,]+|[\s\-–.,]+$/g, '')
    .trim();
}

/** Sentence case for names written in capitals, e.g. lecture titles. */
export function displaySubject(subject: string): string {
  if (/\p{Ll}/u.test(subject)) {
    return subject;
  }
  const lower = subject.toLocaleLowerCase('pl-PL');

  return lower.charAt(0).toLocaleUpperCase('pl-PL') + lower.slice(1);
}

function parseLocation(segment: string) {
  const change = roomChangePattern.exec(segment);
  const main = change ? segment.slice(0, change.index) : segment;
  const slash = main.indexOf('/');
  const room = main
    .slice(0, slash)
    .replace(/^\s*sala\s*/i, '')
    .trim();
  const building = main.slice(slash + 1).trim();
  const roomChanges: RoomChange[] = [];

  if (change?.[3]) {
    const target = change[3];
    const targetSlash = target.indexOf('/');
    roomChanges.push({
      day: Number(change[1]),
      month: Number(change[2]),
      room: (targetSlash >= 0 ? target.slice(0, targetSlash) : target).trim(),
      building:
        targetSlash >= 0 ? target.slice(targetSlash + 1).trim() || null : null,
    });
  }

  return { room: room || null, building: building || null, roomChanges };
}

export function parseScheduleBlock(input: ScheduleBlockInput): ParsedBlock {
  const segments = input.text
    .split(/[\n\t]/)
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const firstLine = segments[0] ?? '';
  const issues: BlockIssue[] = [];
  const sessions: ParsedSession[] = [];
  let currentGroups = parseGroups(firstLine) ?? [];
  let lastTime = parseTimeRange(firstLine);
  let room: string | null = null;
  let building: string | null = null;
  let remote = false;
  let roomChanges: RoomChange[] = [];
  let hasLocation = false;

  segments.forEach((segment, index) => {
    const time = parseTimeRange(segment);
    const weeks = parseWeeks(segment);
    const groups = parseGroups(segment);

    if (time) {
      lastTime = time;
    }
    if (weeks) {
      sessions.push({
        startTime: lastTime?.startTime ?? null,
        endTime: lastTime?.endTime ?? null,
        weeks,
        groups: groups ?? currentGroups,
      });
      return;
    }
    if (groups) {
      // A group line without weeks applies to the following sessions.
      currentGroups = groups;
    }
    if (index === 0) {
      return;
    }
    if (remotePattern.test(segment)) {
      remote = true;
      hasLocation = true;
      return;
    }
    if (segment.includes('/')) {
      ({ room, building, roomChanges } = parseLocation(segment));
      hasLocation = true;
      return;
    }
    if (time || groups || detectClassType(segment)) {
      return;
    }
    const roomOnly = roomOnlyPattern.exec(segment);
    if (roomOnly?.[1]) {
      room = roomOnly[1];
      hasLocation = true;
      return;
    }
    if (index === segments.length - 1 && !hasLocation) {
      // e.g. "Kat. Farmakodynamiki i Farmakologii Molekularnej"
      building = segment;
      hasLocation = true;
      return;
    }
    issues.push({ code: 'unparsed-text', detail: segment });
  });

  if (sessions.length === 0 && lastTime) {
    sessions.push({ ...lastTime, weeks: [], groups: currentGroups });
  }

  const subject = cleanSubject(firstLine);
  const classType = detectClassType(input.text);

  if (!subject) issues.push({ code: 'missing-subject' });
  if (!classType) issues.push({ code: 'missing-type' });
  if (!input.weekday) issues.push({ code: 'missing-weekday' });
  if (sessions.length === 0 || sessions.some((s) => !s.startTime)) {
    issues.push({ code: 'missing-time' });
  }
  if (sessions.length === 0 || sessions.some((s) => s.weeks.length === 0)) {
    issues.push({ code: 'missing-weeks' });
  }
  if (!remote && !room) issues.push({ code: 'missing-room' });
  if (!remote && !building) issues.push({ code: 'missing-building' });

  return {
    id: input.id,
    text: input.text,
    subject,
    classType,
    elective: /do wyboru/i.test(input.text),
    weekday: input.weekday,
    sessions,
    room,
    building,
    remote,
    roomChanges,
    issues,
  };
}
