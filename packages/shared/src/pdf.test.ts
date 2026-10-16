import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PdfReadError, readPdfPages } from './pdf.js';

const plans = join(process.cwd(), '../../e2e/fixtures/plans');

async function pages(name: string) {
  return readPdfPages(new Uint8Array(await readFile(join(plans, name))));
}

/** Text of the runs on one baseline, left to right. */
function lineAt(runs: { x: number; y: number; text: string }[], y: number) {
  return runs
    .filter((run) => Math.abs(run.y - y) < 1)
    .sort((left, right) => left.x - right.x)
    .map((run) => run.text)
    .join('');
}

describe('readPdfPages', () => {
  it('reads every page with Polish text and fonts', async () => {
    const plan = await pages('15-09-2026-ssl-ek-1.pdf');
    expect(plan).toHaveLength(8);

    const [first] = plan;
    const title = first?.runs.find((run) => run.text.startsWith('Wydzia'));
    expect(lineAt(first?.runs ?? [], title?.y ?? 0)).toBe(
      'Wydział Ekonomiczny UG - 1 A SS1 EK',
    );
    expect(
      first?.runs.some((run) => run.font === 'Helvetica-BoldOblique'),
    ).toBe(true);
    expect(
      first?.runs.some(
        (run) => run.text.includes('Zarz') && run.font.includes('Oblique'),
      ),
    ).toBe(true);
  });

  it('finds the coloured frames of the blocks and the grid lines', async () => {
    const [first] = await pages('15-09-2026-ssl-ib-3.pdf');
    const frames = (first?.rects ?? []).filter(
      (rect) =>
        rect.stroke !== null &&
        rect.stroke.some((channel) => channel > 0.1) &&
        rect.height > 10,
    );

    // 6 seminars and 2 lectures on Monday, 2 classes on Tuesday, one on
    // Thursday and one on Friday.
    expect(frames).toHaveLength(12);
    expect(first?.segments.length).toBeGreaterThan(10);
    expect(first?.runs.some((run) => run.vertical)).toBe(true);
  });

  it('rejects files that are not PDFs', async () => {
    await expect(
      readPdfPages(new TextEncoder().encode('PK\u0003\u0004 not a pdf')),
    ).rejects.toBeInstanceOf(PdfReadError);
  });
});
