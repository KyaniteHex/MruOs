import type { ScheduleBlockInput, Weekday } from '@mruos/shared';

// Reads timetables whose classes are text shapes drawn over a day × time
// grid. An .xlsx file is a ZIP of XML parts; the browser's own
// DecompressionStream and DOMParser read it without extra libraries.

export type ScheduleSheet = {
  name: string;
  blocks: ScheduleBlockInput[];
  /** Text cells of the sheet, e.g. the list of subjects under the grid. */
  knownSubjects: string[];
};

export type ScheduleReadError =
  'xls-not-supported' | 'not-xlsx' | 'too-large' | 'no-schedule';

export type ScheduleReadResult =
  | { success: true; sheets: ScheduleSheet[] }
  | { success: false; error: ScheduleReadError };

export const maxScheduleFileBytes = 10 * 1024 * 1024;
const maxPartBytes = 20 * 1024 * 1024;

const dayNames: Record<string, Weekday> = {
  PONIEDZIAŁEK: 'MO',
  WTOREK: 'TU',
  ŚRODA: 'WE',
  CZWARTEK: 'TH',
  PIĄTEK: 'FR',
  SOBOTA: 'SA',
  NIEDZIELA: 'SU',
};

type ZipEntry = { method: number; offset: number; compressedSize: number };

class InvalidWorkbook extends Error {}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function readZipDirectory(data: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(data);
  const decoder = new TextDecoder();
  // The end-of-central-directory record sits in the last 64 KiB + 22 bytes.
  let end = -1;
  for (
    let i = data.byteLength - 22;
    i >= Math.max(0, data.byteLength - 65557);
    i -= 1
  ) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) {
    throw new InvalidWorkbook('Missing ZIP directory');
  }

  const entries = new Map<string, ZipEntry>();
  let pointer = view.getUint32(end + 16, true);
  const count = view.getUint16(end + 10, true);
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) {
      throw new InvalidWorkbook('Corrupt ZIP directory');
    }
    const nameLength = view.getUint16(pointer + 28, true);
    const name = decoder.decode(new Uint8Array(data, pointer + 46, nameLength));
    entries.set(name, {
      method: view.getUint16(pointer + 10, true),
      compressedSize: view.getUint32(pointer + 20, true),
      offset: view.getUint32(pointer + 42, true),
    });
    pointer +=
      46 +
      nameLength +
      view.getUint16(pointer + 30, true) +
      view.getUint16(pointer + 32, true);
  }

  return entries;
}

async function readZipPart(
  data: ArrayBuffer,
  entries: Map<string, ZipEntry>,
  name: string,
): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) {
    return null;
  }
  const view = new DataView(data);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) {
    throw new InvalidWorkbook('Corrupt ZIP entry');
  }
  const start =
    entry.offset +
    30 +
    view.getUint16(entry.offset + 26, true) +
    view.getUint16(entry.offset + 28, true);
  const compressed = new Uint8Array(data, start, entry.compressedSize);

  let bytes: Uint8Array;
  if (entry.method === 0) {
    bytes = compressed;
  } else if (entry.method === 8) {
    const stream = new Response(compressed.slice()).body?.pipeThrough(
      new DecompressionStream('deflate-raw'),
    );
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new InvalidWorkbook('Unsupported ZIP compression');
  }
  if (bytes.byteLength > maxPartBytes) {
    throw new InvalidWorkbook('Workbook part too large');
  }

  return new TextDecoder().decode(bytes);
}

function parseXml(source: string): Document {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new InvalidWorkbook('Invalid XML');
  }

  return document;
}

function byName(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', localName));
}

function child(element: Element, localName: string): Element | undefined {
  return Array.from(element.children).find(
    (candidate) => candidate.localName === localName,
  );
}

function resolvePath(fromPart: string, target: string): string {
  if (target.startsWith('/')) {
    return target.slice(1);
  }
  const parts = fromPart.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }

  return parts.join('/');
}

function relationshipsPath(part: string): string {
  const slash = part.lastIndexOf('/');

  return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`;
}

async function readRelationships(
  data: ArrayBuffer,
  entries: Map<string, ZipEntry>,
  part: string,
) {
  const source = await readZipPart(data, entries, relationshipsPath(part));

  return source
    ? byName(parseXml(source), 'Relationship').map((relationship) => ({
        id: relationship.getAttribute('Id') ?? '',
        type: relationship.getAttribute('Type') ?? '',
        target: resolvePath(part, relationship.getAttribute('Target') ?? ''),
      }))
    : [];
}

function cellRow(reference: string): number {
  return Number(/\d+/.exec(reference)?.[0] ?? 0) - 1;
}

function readCells(sheet: Document, sharedStrings: string[]) {
  return byName(sheet, 'c').flatMap((cell) => {
    const type = cell.getAttribute('t');
    const value = child(cell, 'v')?.textContent ?? '';
    const text =
      type === 's'
        ? (sharedStrings[Number(value)] ?? '')
        : type === 'inlineStr'
          ? byName(cell, 't')
              .map((node) => node.textContent ?? '')
              .join('')
          : type === 'str'
            ? value
            : '';

    return text.trim()
      ? [{ row: cellRow(cell.getAttribute('r') ?? ''), text: text.trim() }]
      : [];
  });
}

function shapeText(shape: Element): string {
  return byName(shape, 'p')
    .map((paragraph) =>
      Array.from(paragraph.children)
        .map((run) =>
          run.localName === 'br' ? '\n' : (child(run, 't')?.textContent ?? ''),
        )
        .join(''),
    )
    .join('\n')
    .trim();
}

function readBlocks(
  drawing: Document,
  dayRows: { row: number; weekday: Weekday }[],
  sheetName: string,
): ScheduleBlockInput[] {
  const anchors = [
    ...byName(drawing, 'twoCellAnchor'),
    ...byName(drawing, 'oneCellAnchor'),
  ];

  return anchors
    .flatMap((anchor) => {
      const from = child(anchor, 'from');
      const row = Number(from ? child(from, 'row')?.textContent : NaN);
      // The day label at or above the anchor row names the block's weekday.
      const weekday =
        dayRows.filter((day) => day.row <= row).at(-1)?.weekday ?? null;

      return byName(anchor, 'sp')
        .map((shape) => shapeText(shape))
        .filter(Boolean)
        .map((text) => ({ text, weekday }));
    })
    .map((block, index) => ({ ...block, id: `${sheetName}#${index + 1}` }));
}

export async function readScheduleWorkbook(
  data: ArrayBuffer,
): Promise<ScheduleReadResult> {
  const header = new Uint8Array(data, 0, Math.min(8, data.byteLength));
  if (startsWith(header, [0xd0, 0xcf, 0x11, 0xe0])) {
    return { success: false, error: 'xls-not-supported' };
  }
  if (!startsWith(header, [0x50, 0x4b, 0x03, 0x04])) {
    return { success: false, error: 'not-xlsx' };
  }
  if (data.byteLength > maxScheduleFileBytes) {
    return { success: false, error: 'too-large' };
  }

  try {
    const entries = readZipDirectory(data);
    const workbookSource = await readZipPart(data, entries, 'xl/workbook.xml');
    if (!workbookSource) {
      return { success: false, error: 'not-xlsx' };
    }
    const sharedStringsSource = await readZipPart(
      data,
      entries,
      'xl/sharedStrings.xml',
    );
    const sharedStrings = sharedStringsSource
      ? byName(parseXml(sharedStringsSource), 'si').map((item) =>
          Array.from(item.children)
            .filter((node) => node.localName !== 'rPh')
            .flatMap((node) =>
              node.localName === 't' ? [node] : byName(node, 't'),
            )
            .map((node) => node.textContent ?? '')
            .join(''),
        )
      : [];
    const workbookRelationships = await readRelationships(
      data,
      entries,
      'xl/workbook.xml',
    );
    const sheets: ScheduleSheet[] = [];

    for (const sheet of byName(parseXml(workbookSource), 'sheet')) {
      const name = sheet.getAttribute('name') ?? '';
      const sheetPart = workbookRelationships.find(
        (relationship) => relationship.id === sheet.getAttribute('r:id'),
      )?.target;
      const sheetSource = sheetPart
        ? await readZipPart(data, entries, sheetPart)
        : null;
      if (!sheetPart || !sheetSource) {
        continue;
      }
      const cells = readCells(parseXml(sheetSource), sharedStrings);
      const dayRows = cells
        .flatMap((cell) => {
          const weekday = dayNames[cell.text.toLocaleUpperCase('pl-PL')];
          return weekday ? [{ row: cell.row, weekday }] : [];
        })
        .sort((left, right) => left.row - right.row);
      const drawingPart = (
        await readRelationships(data, entries, sheetPart)
      ).find((relationship) => relationship.type.endsWith('/drawing'))?.target;
      const drawingSource = drawingPart
        ? await readZipPart(data, entries, drawingPart)
        : null;
      const blocks = drawingSource
        ? readBlocks(parseXml(drawingSource), dayRows, name)
        : [];

      if (blocks.length > 0) {
        sheets.push({
          name,
          blocks,
          knownSubjects: cells
            .map((cell) => cell.text)
            .filter((text) => !dayNames[text.toLocaleUpperCase('pl-PL')]),
        });
      }
    }

    return sheets.length > 0
      ? { success: true, sheets }
      : { success: false, error: 'no-schedule' };
  } catch {
    // Damaged archives or XML: report the file as unreadable.
    return { success: false, error: 'not-xlsx' };
  }
}
