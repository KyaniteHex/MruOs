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
import type { Semester } from '@mruos/shared';
import type { ScheduleImportResult } from './ScheduleImport';

async function planFile(name: string): Promise<File> {
  const bytes = await readFile(
    join(process.cwd(), '../../e2e/fixtures/plans', name),
  );

  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function pdfFile(name: string): Promise<File> {
  const bytes = await readFile(
    join(process.cwd(), '../../e2e/fixtures/plans', name),
  );

  return new File([bytes], name, { type: 'application/pdf' });
}

// The winter semester of UG 2026/2027 with its Monday plan on 28.01.
const ugSemester: Semester = {
  startDate: '2026-10-01',
  daysOff: ['2026-11-11'],
  academicYear: {
    startYear: 2026,
    semesters: [
      {
        term: 'winter',
        startDate: '2026-10-01',
        endDate: '2027-02-21',
        periods: [
          {
            label: 'Zajęcia dydaktyczne',
            kind: 'teaching',
            startDate: '2026-10-01',
            endDate: '2026-12-23',
          },
          {
            label: 'Zajęcia dydaktyczne',
            kind: 'teaching',
            startDate: '2027-01-07',
            endDate: '2027-01-31',
          },
        ],
      },
    ],
    daysOff: [{ date: '2026-11-11', label: 'Narodowe Święto Niepodległości' }],
    dayPlans: [{ date: '2027-01-28', weekday: 'MO' }],
  },
};

describe('ScheduleImport', () => {
  afterEach(cleanup);

  it('imports a UG plan for the chosen group and seminar teacher', async () => {
    const onImport = vi.fn<(result: ScheduleImportResult) => void>();
    render(
      <ScheduleImport
        format="pdf-ug"
        semester={ugSemester}
        existingSeries={[]}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={onImport}
      />,
    );

    fireEvent.change(screen.getByLabelText('Plik planu (.pdf)'), {
      target: { files: [await pdfFile('15-09-2026-ssl-ib-3.pdf')] },
    });
    expect(
      await screen.findByText(
        'Wydział Ekonomiczny UG · 3 SS1 IB · semestr zimowy 2026/2027 · wersja z 15 IX',
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Twoja grupa'), {
      target: { value: 'B' },
    });
    fireEvent.change(
      screen.getByLabelText("Prowadzący: Bachelor's Seminar · Seminarium"),
      { target: { value: 'Krzemiński (Dr Maciej)' } },
    );
    // Two lectures, three classes of group B and the seminar.
    fireEvent.click(screen.getByRole('button', { name: 'Importuj 6 zajęć' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const events = onImport.mock.calls[0]?.[0].events ?? [];
    expect(
      events.find((event) => event.subject === "Bachelor's Seminar"),
    ).toMatchObject({
      teacher: 'Krzemiński (Dr Maciej)',
      room: 'B417',
      building: 'Wydział Ekonomiczny UG',
      // "II tydzień", up to the Monday plan on Thursday 28.01.
      recurrence: {
        byDay: ['MO'],
        startDate: '2026-10-05',
        endDate: '2027-01-28',
      },
    });
    expect(
      events.find((event) => event.subject === 'Market Simulation'),
    ).toMatchObject({
      startTime: '15:15',
      endTime: '16:45',
      room: 'C205 (lab. komp.)',
    });
  });

  it('explains when a PDF is not a UG plan', async () => {
    render(
      <ScheduleImport
        format="pdf-ug"
        semester={ugSemester}
        existingSeries={[]}
        colorFor={() => '#25745b'}
        onCancel={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Plik planu (.pdf)'), {
      target: { files: [await planFile('260922_Farmacja_rok5_sem9.xlsx')] },
    });
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nie rozpoznano planu zajęć UG',
    );
  });

  it('imports the classes of the chosen groups from a real timetable', async () => {
    const onImport = vi.fn<(result: ScheduleImportResult) => void>();
    render(
      <ScheduleImport
        format="xlsx-umk"
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
        format="xlsx-umk"
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
        format="xlsx-umk"
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
        format="xlsx-umk"
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
        format="xlsx-umk"
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
