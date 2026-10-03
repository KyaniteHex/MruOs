import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readScheduleWorkbook } from './xlsxSchedule';

// Tests run from apps/web; the plans are shared with the E2E suite.
const plansDirectory = join(process.cwd(), '../../e2e/fixtures/plans');

async function readPlan(name: string): Promise<ArrayBuffer> {
  const file = await readFile(join(plansDirectory, name));

  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

async function readSheet(name: string) {
  const result = await readScheduleWorkbook(await readPlan(name));
  if (!result.success) {
    throw new Error(`Could not read ${name}: ${result.error}`);
  }

  return result.sheets;
}

describe('readScheduleWorkbook', () => {
  it.each([
    ['260922_Kosmetologia_st1_rok3_sem5.xlsx', 'K III S1', 46],
    ['260922_Farmacja_rok5_sem9.xlsx', 'F V', 52],
    ['260922_Kosmetologia_st2_rok2_sem3.xlsx', 'K II S2', 10],
  ])('reads every class block of %s', async (file, sheetName, blocks) => {
    const [sheet, ...otherSheets] = await readSheet(file);

    expect(otherSheets).toEqual([]);
    expect(sheet?.name).toBe(sheetName);
    expect(sheet?.blocks).toHaveLength(blocks);
    expect(sheet?.blocks.every((block) => block.weekday !== null)).toBe(true);
  });

  it('assigns the weekday from the row the block is drawn in', async () => {
    const [sheet] = await readSheet('260922_Kosmetologia_st1_rok3_sem5.xlsx');

    expect(
      sheet?.blocks.find((block) =>
        block.text.startsWith('Kosmetologia ciała - lab.  gr. 1'),
      ),
    ).toMatchObject({
      weekday: 'TU',
      text: 'Kosmetologia ciała - lab.  gr. 1\n07.00-11.30   (tydz.1-15)\nsala 5/ Jagiellońska 15',
    });
    expect(
      sheet?.blocks.find((block) =>
        block.text.startsWith('PODSTAWY ALERGOLOGII'),
      ),
    ).toMatchObject({ weekday: 'FR' });
    expect(sheet?.knownSubjects).toContain('Kosmetologia ciała');
  });

  it('rejects legacy .xls and other files', async () => {
    const xls = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    const zipHeaderOnly = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

    expect(await readScheduleWorkbook(xls.buffer)).toEqual({
      success: false,
      error: 'xls-not-supported',
    });
    expect(
      await readScheduleWorkbook(new TextEncoder().encode('plan').buffer),
    ).toEqual({ success: false, error: 'not-xlsx' });
    expect(await readScheduleWorkbook(zipHeaderOnly.buffer)).toEqual({
      success: false,
      error: 'not-xlsx',
    });
  });
});
