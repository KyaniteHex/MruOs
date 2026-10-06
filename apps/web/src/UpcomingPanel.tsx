import { useState } from 'react';
import type { EntryRecord, UpcomingAssessment } from '@mruos/shared';
import {
  assessmentKindMarks,
  countdownLabel,
  dayLabel,
  entryMark,
  entryTitle,
} from './entryFormModel';

type UpcomingPanelProps = {
  upcoming: readonly UpcomingAssessment[];
  orphans: readonly EntryRecord[];
  onOpenAssessment: (assessment: UpcomingAssessment) => void;
  onOpenOrphan: (record: EntryRecord) => void;
};

/** Kolokwia and exams of the next 14 days, and entries without a class. */
export function UpcomingPanel({
  upcoming,
  orphans,
  onOpenAssessment,
  onOpenOrphan,
}: UpcomingPanelProps) {
  // Phones show only the nearest one until asked for more.
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="upcoming-panel" aria-labelledby="upcoming-title">
      <div className="details-heading">
        <p className="eyebrow">NAJBLIŻSZE 14 DNI</p>
        <h2 id="upcoming-title">Nadchodzące</h2>
      </div>
      {upcoming.length === 0 ? (
        <p className="details-empty">Nic w najbliższych 14 dniach</p>
      ) : (
        <ol className={`upcoming-list${expanded ? ' is-expanded' : ''}`}>
          {upcoming.map((item) => (
            <li key={item.id}>
              <button
                className={`upcoming-item upcoming-item-${item.assessment.kind}`}
                type="button"
                onClick={() => onOpenAssessment(item)}
              >
                <span className="upcoming-countdown">
                  {countdownLabel(item.daysLeft)}
                </span>
                <span className="upcoming-title">
                  <span aria-hidden="true">
                    {assessmentKindMarks[item.assessment.kind]}
                  </span>{' '}
                  {item.assessment.title}: {item.assessment.subject}
                </span>
                <span className="upcoming-when">
                  {dayLabel(item.start.toJSDate())},{' '}
                  {item.start.toFormat('HH:mm')}
                  {item.room ? ` · sala ${item.room}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {upcoming.length > 1 && (
        <button
          aria-expanded={expanded}
          className="text-button upcoming-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Pokaż mniej' : `Pokaż wszystkie (${upcoming.length})`}
        </button>
      )}
      {orphans.length > 0 && (
        <div className="orphan-entries">
          <h3>Wpisy bez terminu</h3>
          <p className="field-hint">
            Ich zajęcia zniknęły z planu, np. po imporcie albo odwołaniu.
            Wybierz nowy termin albo usuń wpis.
          </p>
          <ul>
            {orphans.map((record) => (
              <li key={record.id}>
                <button
                  className="orphan-item"
                  type="button"
                  onClick={() => onOpenOrphan(record)}
                >
                  <span aria-hidden="true">{entryMark(record.entry)}</span>{' '}
                  {entryTitle(record.entry)} · {record.entry.subject}
                  {record.entry.anchor.type === 'class' &&
                    ` · ${record.entry.anchor.date}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
