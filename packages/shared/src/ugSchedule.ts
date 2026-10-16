import { PdfReadError, readPdfPages } from './pdf.js';
import type { PdfPage, PdfRect, PdfTextRun } from './pdf.js';
import { parseWeekList } from './scheduleBlock.js';
import type {
  BlockIssue,
  DayMonth,
  ParsedBlock,
  ParsedSession,
  RoomChange,
  WeekParity,
} from './scheduleBlock.js';
import type { AcademicTerm, ClassType, Weekday } from './types.js';

// Reads timetables of the Faculty of Economics of the University of Gdańsk,
// exported from CELCAT and printed to PDF: one page per student group, days
// in rows, and each class in a coloured frame such as
//
//   Ćwiczenia, 09:45-11:15, I tydzień      (type, hours, weeks)
//   Makroekonomia I                        (bold italic)
//   C101                                   (room)
//   Neumann (Dr Lilia)                     (bold: teachers)
//   1 A SS1 EK                             (groups)
//   23 X zajęcia w C301                    (notes)

export type UgPlan = {
  /** e.g. "Wydział Ekonomiczny UG". */
  faculty: string;
  /** The year and programme without the group, e.g. "1 SS1 EK". */
  programme: string;
  /** Group letters, one per page, e.g. ["A", "B", "C"]. */
  groups: string[];
  term: AcademicTerm | null;
  /** e.g. "2026/2027". */
  academicYear: string | null;
  /** e.g. "wersja z 15 IX". */
  version: string | null;
  blocks: ParsedBlock[];
};

export class UgPlanError extends Error {}

type Line = { text: string; style: 'regular' | 'bold' | 'italic'; y: number };

const headerPattern =
  /^(?<type>.+?),\s*(?<start>\d{1,2}:\d{2})\s*-\s*(?<end>\d{1,2}:\d{2}),\s*(?<weeks>I\s+i\s+II\s+tydzień|II\s+tydzień|I\s+tydzień|Tydz\.\s*(?<list>[\d\s,–-]+))$/iu;
const groupItemPattern = /^\d+\s+(?:([A-Z])\s+)?[A-Z]{2}\d\s+\S+$/u;
const romanMonths = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];
const notePattern =
  /^(?<dates>\d{1,2}\s+[IVX]+(?:\s*,\s*\d{1,2}\s+[IVX]+)*)\b\s*(?<rest>.*)$/u;
const roomChangePattern = /^zajęcia\s+w\s+(?<room>.+)$/iu;
const remoteRoomPattern = /^!?\s*on-?line$/iu;

const dayPrefixes: [RegExp, Weekday][] = [
  [/^pon/u, 'MO'],
  [/^wt/u, 'TU'],
  [/^(śr|sr)/u, 'WE'],
  [/^czw/u, 'TH'],
  [/^(pi|pt)/u, 'FR'],
  [/^sob/u, 'SA'],
  [/^(nie|nd)/u, 'SU'],
];

function styleOf(font: string): Line['style'] {
  if (/oblique|italic/i.test(font)) return 'italic';
  return /bold/i.test(font) ? 'bold' : 'regular';
}

/** Text runs grouped into lines, top to bottom and left to right. */
function linesOf(runs: readonly PdfTextRun[]): Line[] {
  const sorted = [...runs].sort((left, right) => right.y - left.y);
  const lines: { y: number; runs: PdfTextRun[] }[] = [];
  for (const run of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - run.y) < 1.5);
    if (line) {
      line.runs.push(run);
    } else {
      lines.push({ y: run.y, runs: [run] });
    }
  }

  return lines.map(({ y, runs: lineRuns }) => {
    const ordered = [...lineRuns].sort((left, right) => left.x - right.x);
    // The style of most of the text; a letter like "ą" may use another font.
    const weights = new Map<Line['style'], number>();
    for (const run of ordered) {
      const style = styleOf(run.font);
      weights.set(style, (weights.get(style) ?? 0) + run.text.length);
    }
    const style =
      [...weights].sort((left, right) => right[1] - left[1])[0]?.[0] ??
      'regular';

    return {
      text: ordered
        .map((run) => run.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
      style,
      y,
    };
  });
}

/** Joins wrapped lines; a line ending with "-" continues the same word. */
function joinLines(lines: readonly string[]): string {
  return lines
    .reduce(
      (joined, line) =>
        joined === ''
          ? line
          : joined.endsWith('-')
            ? `${joined.replace(/\s+-$/u, '-')}${line}`
            : `${joined} ${line}`,
      '',
    )
    .trim();
}

function isFrame(rect: PdfRect): boolean {
  return (
    rect.stroke !== null &&
    rect.stroke.some((channel) => channel > 0.1) &&
    rect.height > 10 &&
    rect.width > 10
  );
}

function inside(run: PdfTextRun, rect: PdfRect): boolean {
  return (
    run.x >= rect.x - 1 &&
    run.x <= rect.x + rect.width &&
    run.y >= rect.y - 1 &&
    run.y <= rect.y + rect.height
  );
}

function weekdayOf(label: string): Weekday | null {
  const normalized = label.toLocaleLowerCase('pl-PL').replace(/\s+/g, '');
  return dayPrefixes.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

type DayRow = { top: number; bottom: number; weekday: Weekday | null };

/**
 * Rows between the long horizontal lines of the grid, named by the rotated
 * day labels in the first column, e.g. "Ś" + "roda".
 */
function dayRows(page: PdfPage): DayRow[] {
  const levels = [
    ...new Set(
      page.segments
        .filter(
          (segment) =>
            Math.abs(segment.y1 - segment.y2) < 0.5 &&
            Math.abs(segment.x2 - segment.x1) > 200,
        )
        .map((segment) => Math.round(segment.y1 * 2) / 2),
    ),
  ].sort((left, right) => right - left);
  const labels = page.runs.filter((run) => run.vertical);
  const rows: DayRow[] = [];
  for (let index = 1; index < levels.length; index += 1) {
    const top = levels[index - 1] ?? 0;
    const bottom = levels[index] ?? 0;
    const label = labels
      .filter((run) => run.y < top && run.y > bottom)
      .sort((left, right) => left.y - right.y)
      .map((run) => run.text)
      .join('');
    if (label) {
      rows.push({ top, bottom, weekday: weekdayOf(label) });
    }
  }
  return rows;
}

function classTypeOf(typeText: string): {
  classType: ClassType | null;
  languageBlock: boolean;
  guessed: boolean;
} {
  const type = typeText.toLocaleLowerCase('pl-PL');
  const result = (classType: ClassType | null, guessed = false) => ({
    classType,
    languageBlock: false,
    guessed,
  });
  if (type.startsWith('blok języków')) {
    return { classType: 'cwiczenia', languageBlock: true, guessed: false };
  }
  if (type.startsWith('wykład')) return result('wyklad');
  if (type.startsWith('ćwiczenia') || type.startsWith('lektorat')) {
    return result('cwiczenia');
  }
  if (type.startsWith('laboratorium')) return result('laboratorium');
  if (type.startsWith('seminarium') || type.startsWith('konwersatorium')) {
    return result('seminarium');
  }
  if (/^(blok projektowy|projekt|warsztaty)/u.test(type)) {
    return result('zajecia-praktyczne');
  }
  if (type.startsWith('spotkanie')) return result('wyklad', true);
  return result(null);
}

function weeksOf(header: RegExpExecArray): Pick<ParsedSession, 'weeks'> & {
  parity?: WeekParity;
} {
  const weeks = (header.groups?.weeks ?? '').toLocaleLowerCase('pl-PL');
  if (header.groups?.list) {
    return { weeks: parseWeekList(header.groups.list.replace(/–/g, '-')) };
  }
  if (/^i\s+i\s+ii/u.test(weeks)) return { weeks: [], parity: 'all' };
  if (/^ii\s/u.test(weeks)) return { weeks: [], parity: 'even' };
  return { weeks: [], parity: 'odd' };
}

function datesOf(list: string): DayMonth[] {
  return list.split(',').flatMap((item) => {
    const [day = '', roman = ''] = item.trim().split(/\s+/);
    const month = romanMonths.indexOf(roman) + 1;
    return month > 0 ? [{ day: Number(day), month }] : [];
  });
}

function pad(time: string): string {
  return time.padStart(5, '0');
}

/** One class frame of a page, or null when it is not a class. */
function parseFrame(
  lines: readonly Line[],
  id: string,
  weekday: Weekday | null,
  faculty: string,
): ParsedBlock | null {
  let index = 0;
  const headerLines: string[] = [];
  let header: RegExpExecArray | null = null;
  while (index < lines.length && !header) {
    const line = lines[index];
    if (!line || line.style !== 'regular') break;
    headerLines.push(line.text);
    header = headerPattern.exec(joinLines(headerLines));
    index += 1;
  }
  if (!header?.groups) {
    return null;
  }

  const subjectLines: string[] = [];
  while (lines[index]?.style === 'italic') {
    subjectLines.push(lines[index]?.text ?? '');
    index += 1;
  }
  const rest = lines.slice(index);
  const teacherStart = rest.findIndex((line) => line.style === 'bold');
  const teacherEnd =
    teacherStart === -1
      ? -1
      : rest.findIndex(
          (line, position) => position > teacherStart && line.style !== 'bold',
        );
  const teacherLines =
    teacherStart === -1
      ? []
      : rest.slice(teacherStart, teacherEnd === -1 ? undefined : teacherEnd);
  const before = teacherStart === -1 ? rest : rest.slice(0, teacherStart);
  const after =
    teacherStart === -1 || teacherEnd === -1 ? [] : rest.slice(teacherEnd);

  // Without teachers the groups follow the room directly.
  const regular = [...before, ...after].map((line) => line.text);
  const roomLines: string[] = [];
  const groupLines: string[] = [];
  const noteLines: string[] = [];
  for (const text of regular) {
    if (notePattern.test(text)) {
      noteLines.push(text);
    } else if (
      groupLines.length > 0 ||
      groupItemPattern.test(text.split(',')[0]?.trim() ?? '')
    ) {
      groupLines.push(text);
    } else if (
      teacherStart === -1 ||
      before.some((line) => line.text === text)
    ) {
      roomLines.push(text);
    } else {
      noteLines.push(text);
    }
  }

  const issues: BlockIssue[] = [];
  const typeText = header.groups.type?.trim() ?? '';
  const { classType, languageBlock, guessed } = classTypeOf(typeText);
  if (!classType) issues.push({ code: 'missing-type' });
  if (guessed) issues.push({ code: 'guessed-type', detail: typeText });

  const room = joinLines(roomLines) || null;
  const remote =
    /online/iu.test(typeText) ||
    (room !== null && remoteRoomPattern.test(room));
  if (!remote && !room) issues.push({ code: 'missing-room' });

  const groupItems = joinLines(groupLines)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const letters = groupItems.flatMap(
    (item) => groupItemPattern.exec(item)?.[1] ?? [],
  );

  const roomChanges: RoomChange[] = [];
  const onlyOn: DayMonth[] = [];
  for (const note of noteLines) {
    const match = notePattern.exec(note);
    const dates = match?.groups ? datesOf(match.groups.dates ?? '') : [];
    const change = roomChangePattern.exec(match?.groups?.rest?.trim() ?? '');
    if (dates.length > 0 && !match?.groups?.rest?.trim()) {
      onlyOn.push(...dates);
    } else if (dates.length > 0 && change?.groups?.room) {
      roomChanges.push(
        ...dates.map((date) => ({
          ...date,
          room: change.groups?.room?.trim() ?? '',
          building: null,
        })),
      );
    } else {
      issues.push({ code: 'unparsed-text', detail: note });
    }
  }

  const subject = languageBlock
    ? 'Blok języków obcych'
    : joinLines(subjectLines);
  if (!subject) issues.push({ code: 'missing-subject' });
  if (!weekday) issues.push({ code: 'missing-weekday' });

  return {
    id,
    text: lines.map((line) => line.text).join('\n'),
    subject,
    classType,
    elective: languageBlock,
    weekday,
    sessions: [
      {
        startTime: pad(header.groups.start ?? ''),
        endTime: pad(header.groups.end ?? ''),
        ...weeksOf(header),
        groups: letters,
      },
    ],
    room: remote ? null : room,
    building: remote || !room ? null : faculty,
    remote,
    roomChanges,
    teacher: joinLines(teacherLines.map((line) => line.text)) || null,
    onlyOn,
    issues,
  };
}

/** What a frame says, to drop the copies of shared classes on every page. */
function signature(block: ParsedBlock): string {
  return JSON.stringify({ ...block, id: undefined, issues: undefined });
}

/**
 * Classes of the same subject and type for the whole year, held by different
 * teachers, are alternatives, e.g. diploma seminars: the teacher becomes the
 * "group" the student chooses.
 */
function markAlternatives(blocks: ParsedBlock[]): ParsedBlock[] {
  const bySubject = new Map<string, ParsedBlock[]>();
  for (const block of blocks) {
    if (block.sessions.every((session) => session.groups.length === 0)) {
      const key = `${block.subject.toLocaleLowerCase('pl-PL')}|${block.classType}`;
      bySubject.set(key, [...(bySubject.get(key) ?? []), block]);
    }
  }
  const alternatives = new Set(
    [...bySubject.values()]
      .filter(
        (group) => new Set(group.map((block) => block.teacher ?? '')).size > 1,
      )
      .flat(),
  );

  return blocks.map((block) =>
    alternatives.has(block)
      ? {
          ...block,
          sessions: block.sessions.map((session) => ({
            ...session,
            groups: [block.teacher ?? 'Bez prowadzącego'],
          })),
        }
      : block,
  );
}

/** The plan written on the pages of a UG timetable PDF. */
export function parseUgPages(pages: readonly PdfPage[]): UgPlan {
  let faculty = '';
  let programme = '';
  let term: AcademicTerm | null = null;
  let academicYear: string | null = null;
  let version: string | null = null;
  const groups: string[] = [];
  const blocks: ParsedBlock[] = [];
  const seen = new Set<string>();

  pages.forEach((page, pageIndex) => {
    const top = linesOf(page.runs.filter((run) => !run.vertical)).slice(0, 4);
    const titleLine = top.find((line) => /^Plan zajęć/u.test(line.text));
    const groupLine = top.find((line) => / UG - /u.test(line.text));
    if (titleLine) {
      const title = titleLine.text;
      term = /zimowy/iu.test(title)
        ? 'winter'
        : /letni/iu.test(title)
          ? 'summer'
          : term;
      academicYear = /(\d{4}\/\d{4})/u.exec(title)?.[1] ?? academicYear;
      version = /\((wersja[^)]*)\)/u.exec(title)?.[1] ?? version;
    }
    if (!groupLine) {
      return;
    }
    const [pageFaculty = '', pageGroup = ''] = groupLine.text.split(' - ');
    faculty = pageFaculty.trim();
    const groupMatch = /^(\d+)\s+(?:([A-Z])\s+)?(.+)$/u.exec(pageGroup.trim());
    programme = groupMatch
      ? `${groupMatch[1]} ${groupMatch[3]}`
      : pageGroup.trim();
    if (groupMatch?.[2] && !groups.includes(groupMatch[2])) {
      groups.push(groupMatch[2]);
    }

    const rows = dayRows(page);
    const frames = page.rects
      .filter(isFrame)
      .sort((left, right) => right.y - left.y || left.x - right.x);
    frames.forEach((frame, frameIndex) => {
      const middle = frame.y + frame.height / 2;
      const row = rows.find(
        (candidate) => middle < candidate.top && middle > candidate.bottom,
      );
      const block = parseFrame(
        linesOf(page.runs.filter((run) => !run.vertical && inside(run, frame))),
        `p${pageIndex + 1}-${frameIndex + 1}`,
        row?.weekday ?? null,
        faculty,
      );
      if (block && !seen.has(signature(block))) {
        seen.add(signature(block));
        blocks.push(block);
      }
    });
  });

  if (blocks.length === 0) {
    throw new UgPlanError('no-schedule');
  }

  return {
    faculty,
    programme,
    groups,
    term,
    academicYear,
    version,
    blocks: markAlternatives(blocks),
  };
}

/** Reads a UG timetable from the bytes of its PDF file. */
export async function readUgPlan(data: Uint8Array): Promise<UgPlan> {
  try {
    return parseUgPages(await readPdfPages(data));
  } catch (error) {
    if (error instanceof PdfReadError || error instanceof UgPlanError) {
      throw new UgPlanError(error.message);
    }
    throw error;
  }
}
