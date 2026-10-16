// Reads positioned text and drawn rectangles from simple PDF files, such as
// timetables printed to PDF: plain or Flate-compressed streams and one-byte
// fonts with WinAnsi encoding, Differences or ToUnicode maps. That is enough
// to rebuild a timetable's grid; it is not a general PDF reader (no object
// streams, no CID fonts, no encryption).

export type PdfColor = [red: number, green: number, blue: number];

export type PdfTextRun = {
  /** Start of the text in page points, origin at the bottom left. */
  x: number;
  y: number;
  text: string;
  /** Base font name without the subset prefix, e.g. "Helvetica-Bold". */
  font: string;
  /** Rotated text, e.g. day names written upwards in a grid's first column. */
  vertical: boolean;
};

export type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: PdfColor | null;
  fill: PdfColor | null;
};

export type PdfSegment = { x1: number; y1: number; x2: number; y2: number };

export type PdfPage = {
  runs: PdfTextRun[];
  rects: PdfRect[];
  /** Straight stroked lines, e.g. the rows and columns of a table. */
  segments: PdfSegment[];
};

export class PdfReadError extends Error {}

type PdfName = { name: string };
type PdfRef = { ref: number };
type PdfValue =
  number | boolean | null | string | PdfName | PdfRef | PdfValue[] | PdfDict;
type PdfDict = { dict: Map<string, PdfValue> };

const whitespace = new Set([0, 9, 10, 12, 13, 32]);
const delimiters = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));
const referenceTail = /\s+\d+\s+R(?![A-Za-z])/y;

function isName(value: PdfValue | undefined): value is PdfName {
  return typeof value === 'object' && value !== null && 'name' in value;
}

function isRef(value: PdfValue | undefined): value is PdfRef {
  return typeof value === 'object' && value !== null && 'ref' in value;
}

function isDict(value: PdfValue | undefined): value is PdfDict {
  return typeof value === 'object' && value !== null && 'dict' in value;
}

/** Bytes as a string with one character per byte, for searching. */
function latin1(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return text;
}

/** Parses PDF objects: numbers, names, strings, arrays, dicts and refs. */
class ObjectParser {
  constructor(
    private readonly text: string,
    public position = 0,
  ) {}

  private skipSpace() {
    const { text } = this;
    while (this.position < text.length) {
      const code = text.charCodeAt(this.position);
      if (whitespace.has(code)) {
        this.position += 1;
      } else if (code === 37) {
        // A comment runs to the end of the line.
        while (
          this.position < text.length &&
          text[this.position] !== '\n' &&
          text[this.position] !== '\r'
        ) {
          this.position += 1;
        }
      } else {
        return;
      }
    }
  }

  private word(): string {
    const start = this.position;
    while (this.position < this.text.length) {
      const code = this.text.charCodeAt(this.position);
      if (whitespace.has(code) || delimiters.has(code)) {
        break;
      }
      this.position += 1;
    }
    return this.text.slice(start, this.position);
  }

  /** A literal string "(...)" with escapes and balanced parentheses. */
  literalString(): string {
    const { text } = this;
    let depth = 0;
    let result = '';
    this.position += 1;
    while (this.position < text.length) {
      const char = text[this.position] ?? '';
      this.position += 1;
      if (char === '\\') {
        const next = text[this.position] ?? '';
        this.position += 1;
        if (/[0-7]/.test(next)) {
          let digits = next;
          while (digits.length < 3 && /[0-7]/.test(text[this.position] ?? '')) {
            digits += text[this.position];
            this.position += 1;
          }
          result += String.fromCharCode(parseInt(digits, 8) & 255);
        } else if (next === '\r' || next === '\n') {
          if (next === '\r' && text[this.position] === '\n') {
            this.position += 1;
          }
        } else {
          result +=
            { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[next] ?? next;
        }
      } else if (char === '(') {
        depth += 1;
        result += char;
      } else if (char === ')') {
        if (depth === 0) {
          return result;
        }
        depth -= 1;
        result += char;
      } else {
        result += char;
      }
    }
    return result;
  }

  /** A hex string "<48 65>". */
  hexString(): string {
    const end = this.text.indexOf('>', this.position);
    const hex = this.text
      .slice(this.position + 1, end === -1 ? undefined : end)
      .replace(/\s+/g, '');
    this.position = end === -1 ? this.text.length : end + 1;
    let result = '';
    for (let index = 0; index < hex.length; index += 2) {
      result += String.fromCharCode(
        parseInt(hex.slice(index, index + 2).padEnd(2, '0'), 16),
      );
    }
    return result;
  }

  value(): PdfValue | undefined {
    this.skipSpace();
    const { text } = this;
    const char = text[this.position];
    if (char === undefined) {
      return undefined;
    }
    if (char === '/') {
      this.position += 1;
      return { name: this.word() };
    }
    if (char === '(') {
      return this.literalString();
    }
    if (char === '<' && text[this.position + 1] === '<') {
      this.position += 2;
      const dict = new Map<string, PdfValue>();
      for (;;) {
        this.skipSpace();
        if (text.startsWith('>>', this.position)) {
          this.position += 2;
          return { dict };
        }
        const key = this.value();
        if (!isName(key)) {
          return { dict };
        }
        const value = this.value();
        if (value !== undefined) {
          dict.set(key.name, value);
        }
      }
    }
    if (char === '<') {
      return this.hexString();
    }
    if (char === '[') {
      this.position += 1;
      const items: PdfValue[] = [];
      for (;;) {
        this.skipSpace();
        if (text[this.position] === ']' || this.position >= text.length) {
          this.position += 1;
          return items;
        }
        const item = this.value();
        if (item === undefined) {
          return items;
        }
        items.push(item);
      }
    }
    const word = this.word();
    if (word === '') {
      // A stray delimiter, e.g. ")" or "}", is skipped.
      this.position += 1;
      return null;
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      // "12 0 R" is a reference to object 12.
      referenceTail.lastIndex = this.position;
      const generation = referenceTail.exec(text);
      if (/^\d+$/.test(word) && generation) {
        this.position = referenceTail.lastIndex;
        return { ref: Number(word) };
      }
      return Number(word);
    }
    if (word === 'true' || word === 'false') {
      return word === 'true';
    }
    return null;
  }
}

type PdfObject = { value: PdfValue; stream?: Uint8Array };

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

class PdfDocument {
  private readonly offsets = new Map<number, number>();
  private readonly cache = new Map<number, PdfObject>();
  private readonly text: string;

  constructor(private readonly bytes: Uint8Array) {
    this.text = latin1(bytes);
    if (!this.text.startsWith('%PDF-')) {
      throw new PdfReadError('not-pdf');
    }
    // Later definitions win, as in incremental updates.
    for (const match of this.text.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
      this.offsets.set(Number(match[1]), (match.index ?? 0) + match[0].length);
    }
  }

  object(number: number): PdfObject | null {
    const cached = this.cache.get(number);
    if (cached) {
      return cached;
    }
    const offset = this.offsets.get(number);
    if (offset === undefined) {
      return null;
    }
    const parser = new ObjectParser(this.text, offset);
    const value = parser.value() ?? null;
    const object: PdfObject = { value };
    const afterValue = /^\s*stream\r?\n/.exec(
      this.text.slice(parser.position, parser.position + 20),
    );
    if (afterValue && isDict(value)) {
      const start = parser.position + afterValue[0].length;
      const declared = this.resolve(value.dict.get('Length'));
      const end =
        typeof declared === 'number'
          ? start + declared
          : this.text.indexOf('endstream', start);
      object.stream = this.bytes.subarray(start, Math.max(start, end));
    }
    this.cache.set(number, object);
    return object;
  }

  resolve(value: PdfValue | undefined): PdfValue | undefined {
    return isRef(value) ? (this.object(value.ref)?.value ?? undefined) : value;
  }

  dict(value: PdfValue | undefined): Map<string, PdfValue> {
    const resolved = this.resolve(value);
    return isDict(resolved) ? resolved.dict : new Map();
  }

  /** The decoded bytes of a stream object; empty for unsupported filters. */
  async streamOf(value: PdfValue | undefined): Promise<Uint8Array> {
    if (!isRef(value)) {
      return new Uint8Array();
    }
    const object = this.object(value.ref);
    if (!object?.stream || !isDict(object.value)) {
      return new Uint8Array();
    }
    const filter = this.resolve(object.value.dict.get('Filter'));
    const filters = (Array.isArray(filter) ? filter : [filter]).filter(isName);
    if (filters.length === 0) {
      return object.stream;
    }
    if (filters.length === 1 && filters[0]?.name === 'FlateDecode') {
      try {
        return await inflate(object.stream);
      } catch {
        // Some writers count the end-of-line before "endstream" in Length.
        return inflate(object.stream.subarray(0, object.stream.length - 1));
      }
    }
    return new Uint8Array();
  }

  /** Pages in order, with the resources they inherit. */
  pages(): { page: Map<string, PdfValue>; resources: Map<string, PdfValue> }[] {
    const catalog = [...this.offsets.keys()]
      .map((number) => this.object(number)?.value)
      .find(
        (value) =>
          isDict(value) &&
          isName(value.dict.get('Type')) &&
          (value.dict.get('Type') as PdfName).name === 'Catalog',
      );
    if (!isDict(catalog)) {
      throw new PdfReadError('no-pages');
    }
    const result: {
      page: Map<string, PdfValue>;
      resources: Map<string, PdfValue>;
    }[] = [];
    const visit = (
      node: PdfValue | undefined,
      inherited: Map<string, PdfValue>,
      depth: number,
    ) => {
      const dict = this.dict(node);
      if (depth > 32 || dict.size === 0) {
        return;
      }
      const resources = dict.has('Resources')
        ? this.dict(dict.get('Resources'))
        : inherited;
      const kids = this.resolve(dict.get('Kids'));
      if (Array.isArray(kids)) {
        kids.forEach((kid) => visit(kid, resources, depth + 1));
      } else {
        result.push({ page: dict, resources });
      }
    };
    visit(catalog.dict.get('Pages'), new Map(), 0);
    return result;
  }
}

// Glyph names used by PDF fonts, beyond single letters and digits.
const glyphNames: Record<string, string> = {
  space: ' ',
  exclam: '!',
  quotedbl: '"',
  numbersign: '#',
  dollar: '$',
  percent: '%',
  ampersand: '&',
  quotesingle: "'",
  quoteright: '’',
  quoteleft: '‘',
  quotedblleft: '“',
  quotedblright: '”',
  quotedblbase: '„',
  parenleft: '(',
  parenright: ')',
  asterisk: '*',
  plus: '+',
  comma: ',',
  hyphen: '-',
  endash: '–',
  emdash: '—',
  period: '.',
  slash: '/',
  colon: ':',
  semicolon: ';',
  less: '<',
  equal: '=',
  greater: '>',
  question: '?',
  at: '@',
  bracketleft: '[',
  backslash: '\\',
  bracketright: ']',
  underscore: '_',
  bar: '|',
  bullet: '•',
  ellipsis: '…',
  degree: '°',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  aogonek: 'ą',
  Aogonek: 'Ą',
  cacute: 'ć',
  Cacute: 'Ć',
  eogonek: 'ę',
  Eogonek: 'Ę',
  lslash: 'ł',
  Lslash: 'Ł',
  nacute: 'ń',
  Nacute: 'Ń',
  oacute: 'ó',
  Oacute: 'Ó',
  sacute: 'ś',
  Sacute: 'Ś',
  zacute: 'ź',
  Zacute: 'Ź',
  zdotaccent: 'ż',
  Zdotaccent: 'Ż',
};

const winAnsi: string[] = (() => {
  const decoder = new TextDecoder('windows-1252');
  return Array.from({ length: 256 }, (_, code) =>
    decoder.decode(new Uint8Array([code])),
  );
})();

type PdfFont = { name: string; table: string[] };

async function loadFont(
  document: PdfDocument,
  value: PdfValue | undefined,
): Promise<PdfFont> {
  const font = document.dict(value);
  const baseFont = document.resolve(font.get('BaseFont'));
  const name = isName(baseFont) ? baseFont.name.replace(/^[A-Z]{6}\+/, '') : '';
  const table = [...winAnsi];

  const encoding = document.resolve(font.get('Encoding'));
  if (isDict(encoding)) {
    const differences = document.resolve(encoding.dict.get('Differences'));
    if (Array.isArray(differences)) {
      let code = 0;
      for (const item of differences) {
        if (typeof item === 'number') {
          code = item;
        } else if (isName(item)) {
          const glyph = item.name;
          table[code] =
            glyphNames[glyph] ??
            (glyph.length === 1 ? glyph : (table[code] ?? ''));
          code += 1;
        }
      }
    }
  }

  const toUnicode = font.get('ToUnicode');
  if (toUnicode) {
    const cmap = latin1(await document.streamOf(toUnicode));
    for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const [, from = '', to = '', target = ''] of (
        block[1] ?? ''
      ).matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
        const first = parseInt(from, 16);
        for (let code = first; code <= parseInt(to, 16) && code < 256; code++) {
          table[code] = String.fromCharCode(
            parseInt(target, 16) + code - first,
          );
        }
      }
    }
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const [, from = '', target = ''] of (block[1] ?? '').matchAll(
        /<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi,
      )) {
        const code = parseInt(from, 16);
        if (code < 256) {
          table[code] = String.fromCharCode(parseInt(target, 16));
        }
      }
    }
  }

  return { name, table };
}

type Matrix = [number, number, number, number, number, number];

const identity: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [A, B, C, D, E, F] = right;
  return [
    a * A + b * C,
    a * B + b * D,
    c * A + d * C,
    c * B + d * D,
    e * A + f * C + E,
    e * B + f * D + F,
  ];
}

function apply(matrix: Matrix, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

type Operand = number | string | PdfName | Operand[] | null;

/** Splits a content stream into operands and operators. */
function* contentOperations(
  content: string,
): Generator<{ operator: string; operands: Operand[] }> {
  const parser = new ObjectParser(content);
  const operands: Operand[] = [];
  for (;;) {
    const start = parser.position;
    const value = parser.value();
    if (value === undefined) {
      return;
    }
    if (value === null) {
      const word = content.slice(start, parser.position).trim();
      if (word === 'BI') {
        // Inline images carry binary data up to "EI".
        const end = content.indexOf('EI', parser.position);
        parser.position = end === -1 ? content.length : end + 2;
        operands.length = 0;
        continue;
      }
      if (/^[A-Za-z'"*]+[0-9]?\*?$/.test(word)) {
        yield { operator: word, operands: [...operands] };
      }
      operands.length = 0;
      continue;
    }
    if (isDict(value) || isRef(value) || typeof value === 'boolean') {
      operands.push(null);
      continue;
    }
    operands.push(value as Operand);
  }
}

function numbers(operands: Operand[], count: number): number[] {
  return operands
    .slice(-count)
    .map((operand) => (typeof operand === 'number' ? operand : 0));
}

function colorOf(values: number[]): PdfColor {
  if (values.length >= 4) {
    const [c = 0, m = 0, y = 0, k = 0] = values;
    return [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
  }
  if (values.length === 3) {
    return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
  }
  const gray = values[0] ?? 0;
  return [gray, gray, gray];
}

type GraphicsState = { ctm: Matrix; stroke: PdfColor; fill: PdfColor };

async function readPage(
  document: PdfDocument,
  page: Map<string, PdfValue>,
  resources: Map<string, PdfValue>,
): Promise<PdfPage> {
  const contents = document.resolve(page.get('Contents'));
  const parts = Array.isArray(contents) ? contents : [page.get('Contents')];
  const streams = await Promise.all(
    parts.map((part) => document.streamOf(part)),
  );
  const content = streams.map(latin1).join('\n');

  const fontRefs = document.dict(resources.get('Font'));
  const fonts = new Map<string, PdfFont>();
  for (const [name, value] of fontRefs) {
    fonts.set(name, await loadFont(document, value));
  }

  const runs: PdfTextRun[] = [];
  const rects: PdfRect[] = [];
  const segments: PdfSegment[] = [];
  const stack: GraphicsState[] = [];
  let state: GraphicsState = {
    ctm: identity,
    stroke: [0, 0, 0],
    fill: [0, 0, 0],
  };
  let textMatrix: Matrix = identity;
  let lineMatrix: Matrix = identity;
  let leading = 0;
  let font: PdfFont = { name: '', table: winAnsi };
  let fontSize = 1;
  let pathRects: [number, number, number, number][] = [];
  let pathLines: [number, number, number, number][] = [];
  let current: [number, number] = [0, 0];

  const moveText = (tx: number, ty: number) => {
    lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix);
    textMatrix = lineMatrix;
  };
  const show = (bytes: string) => {
    const text = Array.from(bytes, (char) => font.table[char.charCodeAt(0)])
      .join('')
      .replaceAll('\u0000', '');
    if (text === '') {
      return;
    }
    const matrix = multiply(
      multiply([fontSize, 0, 0, fontSize, 0, 0], textMatrix),
      state.ctm,
    );
    const [x, y] = apply(matrix, 0, 0);
    runs.push({
      x,
      y,
      text,
      font: font.name,
      vertical: Math.abs(matrix[1]) > Math.abs(matrix[0]),
    });
  };
  const paint = (stroke: boolean, fill: boolean) => {
    for (const [x, y, width, height] of pathRects) {
      const [x1, y1] = apply(state.ctm, x, y);
      const [x2, y2] = apply(state.ctm, x + width, y + height);
      rects.push({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        stroke: stroke ? state.stroke : null,
        fill: fill ? state.fill : null,
      });
    }
    if (stroke) {
      for (const [x1, y1, x2, y2] of pathLines) {
        const [ax, ay] = apply(state.ctm, x1, y1);
        const [bx, by] = apply(state.ctm, x2, y2);
        segments.push({ x1: ax, y1: ay, x2: bx, y2: by });
      }
    }
    pathRects = [];
    pathLines = [];
  };

  for (const { operator, operands } of contentOperations(content)) {
    switch (operator) {
      case 'q':
        stack.push(state);
        break;
      case 'Q':
        state = stack.pop() ?? state;
        break;
      case 'cm': {
        const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = numbers(operands, 6);
        state = { ...state, ctm: multiply([a, b, c, d, e, f], state.ctm) };
        break;
      }
      case 'RG':
      case 'G':
      case 'K':
      case 'SC':
      case 'SCN':
        state = {
          ...state,
          stroke: colorOf(
            operands.filter((item): item is number => typeof item === 'number'),
          ),
        };
        break;
      case 'rg':
      case 'g':
      case 'k':
      case 'sc':
      case 'scn':
        state = {
          ...state,
          fill: colorOf(
            operands.filter((item): item is number => typeof item === 'number'),
          ),
        };
        break;
      case 'm':
        current = numbers(operands, 2) as [number, number];
        break;
      case 'l': {
        const [x = 0, y = 0] = numbers(operands, 2);
        pathLines.push([current[0], current[1], x, y]);
        current = [x, y];
        break;
      }
      case 're': {
        const [x = 0, y = 0, width = 0, height = 0] = numbers(operands, 4);
        pathRects.push([x, y, width, height]);
        break;
      }
      case 'S':
      case 's':
        paint(true, false);
        break;
      case 'f':
      case 'F':
      case 'f*':
        paint(false, true);
        break;
      case 'B':
      case 'B*':
      case 'b':
      case 'b*':
        paint(true, true);
        break;
      case 'n':
        paint(false, false);
        break;
      case 'BT':
        textMatrix = identity;
        lineMatrix = identity;
        break;
      case 'Tf': {
        const [name] = operands.slice(-2);
        font =
          (isName(name as PdfValue) && fonts.get((name as PdfName).name)) ||
          font;
        fontSize = numbers(operands, 1)[0] ?? 1;
        break;
      }
      case 'TL':
        leading = numbers(operands, 1)[0] ?? 0;
        break;
      case 'Tm': {
        const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = numbers(operands, 6);
        lineMatrix = [a, b, c, d, e, f];
        textMatrix = lineMatrix;
        break;
      }
      case 'Td': {
        const [tx = 0, ty = 0] = numbers(operands, 2);
        moveText(tx, ty);
        break;
      }
      case 'TD': {
        const [tx = 0, ty = 0] = numbers(operands, 2);
        leading = -ty;
        moveText(tx, ty);
        break;
      }
      case 'T*':
        moveText(0, -leading);
        break;
      case 'Tj':
      case "'":
      case '"': {
        if (operator !== 'Tj') {
          moveText(0, -leading);
        }
        const text = operands.at(-1);
        if (typeof text === 'string') {
          show(text);
        }
        break;
      }
      case 'TJ': {
        const items = operands.at(-1);
        if (Array.isArray(items)) {
          show(items.filter((item) => typeof item === 'string').join(''));
        }
        break;
      }
    }
  }

  return { runs, rects, segments };
}

/** Reads the text and rectangles of every page. */
export async function readPdfPages(data: Uint8Array): Promise<PdfPage[]> {
  const document = new PdfDocument(data);
  const pages = document.pages();
  if (pages.length === 0) {
    throw new PdfReadError('no-pages');
  }
  return Promise.all(
    pages.map(({ page, resources }) => readPage(document, page, resources)),
  );
}
