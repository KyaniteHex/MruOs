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
        existingSeries={[]}
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
        existingSeries={[]}
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

  it('warns about overlapping classes while groups are chosen', async () => {
    render(
      <ScheduleImport
        semester={{ startDate: '2026-10-05', daysOff: [] }}
        existingSeries={[]}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Plik planu (.xlsx)'), {
      target: { files: [await planFile('260922_Farmacja_rok5_sem9.xlsx')] },
    });
    fireEvent.change(
      await screen.findByLabelText('Grupa: Biofarmacja · Laboratorium'),
      { target: { value: "d'" } },
    );

    // Monday labs: Biofarmacja d' 11:30–15:15 in weeks 6–15.
    const pharmacotherapy = screen.getByLabelText(
      'Grupa: Farmakoterapia i inform. o lekach · Laboratorium',
    );
    const optionLabel = (value: string) =>
      pharmacotherapy.querySelector(`option[value="${value}"]`)?.textContent;
    expect(optionLabel('d')).toBe('gr. d – kolizja');
    expect(optionLabel('e')).toBe('gr. e – kolizja');
    expect(optionLabel('c')).toBe('gr. c');

    fireEvent.change(pharmacotherapy, { target: { value: 'd' } });

    const warnings = await screen.findAllByText(
      'Koliduje z: Biofarmacja, 11:30–15:15: 9 terminów, od 16.11.2026',
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(screen.getByText(/z kolizją/)).toBeTruthy();
  });

  it('suggests setting up the academic calendar before importing', () => {
    const onOpenAcademicYear = vi.fn();
    const { rerender } = render(
      <ScheduleImport
        semester={{ startDate: '2026-10-05', daysOff: [] }}
        existingSeries={[]}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={vi.fn()}
        onOpenAcademicYear={onOpenAcademicYear}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Uzupełnij harmonogram' }),
    );
    expect(onOpenAcademicYear).toHaveBeenCalledTimes(1);

    rerender(
      <ScheduleImport
        semester={{
          startDate: '2026-10-01',
          daysOff: [],
          academicYear: {
            startYear: 2026,
            semesters: [
              {
                term: 'winter',
                startDate: '2026-10-01',
                endDate: '2027-02-21',
                periods: [],
              },
            ],
            daysOff: [],
          },
        }}
        existingSeries={[]}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={vi.fn()}
        onOpenAcademicYear={onOpenAcademicYear}
      />,
    );
    expect(screen.queryByRole('note')).toBeNull();
  });
});
