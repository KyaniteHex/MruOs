import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduleImport } from './ScheduleImport';
import type { ScheduleImportResult } from './ScheduleImport';

async function planFile(name: string): Promise<File> {
  const bytes = await readFile(
    join(process.cwd(), '../../e2e/fixtures/plans', name),
  );

  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('ScheduleImport', () => {
  afterEach(cleanup);

  it('imports the classes of the chosen groups from a real timetable', async () => {
    const onImport = vi.fn<(result: ScheduleImportResult) => void>();
    render(
      <ScheduleImport
        semester={{ startDate: '2026-10-05', daysOff: [] }}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={onImport}
      />,
    );

    fireEvent.change(screen.getByLabelText('Plik planu (.xlsx)'), {
      target: {
        files: [await planFile('260922_Kosmetologia_st2_rok2_sem3.xlsx')],
      },
    });
    const spaGroup = await screen.findByLabelText(
      'Grupa: Kosmetologia z elementami SPA i Wellness · Laboratorium',
    );
    fireEvent.change(spaGroup, { target: { value: '1' } });
    fireEvent.change(
      screen.getByLabelText(
        'Grupa: Chirurgia plastyczna, rekonstrukcyjna i estetyczna · Ćwiczenia',
      ),
      { target: { value: '2' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Importuj 8 zajęć' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const [result] = onImport.mock.calls[0] ?? [];
    expect(result?.replace).toBe(false);
    expect(result?.semesterStartDate).toBe('2026-10-05');
    expect(result?.events).toHaveLength(8);
    expect(
      result?.events.find((event) => event.classType === 'laboratorium'),
    ).toMatchObject({
      subject: 'Kosmetologia z elementami SPA i Wellness',
      room: '9',
      building: 'Jagiellońska 15',
      startTime: '07:00',
      endTime: '13:00',
      recurrence: {
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2026-11-02',
      },
    });
    expect(
      result?.events.some((event) =>
        event.subject.startsWith('Przedsiębiorczość'),
      ),
    ).toBe(false);
  });

  it('explains why a file cannot be imported', async () => {
    render(
      <ScheduleImport
        semester={{ startDate: '2026-10-05', daysOff: [] }}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Plik planu (.xlsx)'), {
      target: {
        files: [
          new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], 'plan.xls'),
        ],
      },
    });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'zapisz jako .xlsx',
    );
  });
});
