import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EntryRecordSchema,
  placeEntries,
  upcomingAssessments,
} from '@mruos/shared';
import { UpcomingBar, UpcomingPanel } from './UpcomingPanel';

const exam = EntryRecordSchema.parse({
  id: 'exam',
  entry: {
    kind: 'exam',
    subject: 'Fizyka',
    title: 'Egzamin',
    reminders: [],
    anchor: {
      type: 'own',
      date: '2026-10-07',
      startTime: '10:00',
      endTime: '12:00',
      room: 'Aula',
    },
  },
});
const orphan = EntryRecordSchema.parse({
  id: 'orphan',
  entry: {
    kind: 'test',
    subject: 'Chemia',
    title: 'Wejściówka',
    reminders: [],
    anchor: {
      type: 'class',
      classType: 'laboratorium',
      date: '2026-10-06',
      startTime: '08:00',
    },
  },
});

describe('UpcomingPanel', () => {
  afterEach(cleanup);

  it('says when nothing is coming up', () => {
    render(
      <UpcomingPanel
        upcoming={[]}
        orphans={[]}
        onOpenAssessment={vi.fn()}
        onOpenOrphan={vi.fn()}
      />,
    );

    expect(screen.getByText('Nic w najbliższych 14 dniach')).toBeTruthy();
  });

  it('counts down to exams and lists entries without a class', () => {
    const placed = placeEntries([exam, orphan], [], { daysOff: [] });
    const onOpenAssessment = vi.fn();
    const onOpenOrphan = vi.fn();
    render(
      <UpcomingPanel
        upcoming={upcomingAssessments(placed.assessments, '2026-10-05')}
        orphans={placed.orphans}
        onOpenAssessment={onOpenAssessment}
        onOpenOrphan={onOpenOrphan}
      />,
    );

    const item = screen.getByRole('button', { name: /Egzamin: Fizyka/ });
    expect(item.textContent).toContain('za 2 dni');
    expect(item.textContent).toContain('śr., 7 paź, 10:00 · sala Aula');
    fireEvent.click(item);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Wejściówka · Chemia · 2026-10-06',
      }),
    );

    expect(onOpenAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'exam', daysLeft: 2 }),
    );
    expect(onOpenOrphan).toHaveBeenCalledWith(orphan);
  });

  it('sums up on one line on narrow screens', () => {
    const placed = placeEntries([exam, orphan], [], { daysOff: [] });
    const onOpen = vi.fn();
    const { rerender } = render(
      <UpcomingBar
        upcoming={upcomingAssessments(placed.assessments, '2026-10-06')}
        orphans={placed.orphans}
        onOpen={onOpen}
      />,
    );

    const bar = screen.getByRole('button', { name: /^Nadchodzące:/ });
    expect(bar.textContent).toContain('jutro 10:00 · Egzamin: Fizyka');
    expect(bar.textContent).toContain('! 1 bez terminu');
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledOnce();

    rerender(
      <UpcomingBar upcoming={[]} orphans={placed.orphans} onOpen={onOpen} />,
    );
    expect(bar.textContent).toContain('1 wpis bez terminu');

    rerender(<UpcomingBar upcoming={[]} orphans={[]} onOpen={onOpen} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
