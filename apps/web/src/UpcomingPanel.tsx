import type { EntryRecord, UpcomingAssessment } from '@mruos/shared';
import {
  assessmentKindMarks,
  countdownLabel,
  dayLabel,
  entryMark,
  entryTitle,
  orphanCountLabel,
} from './entryFormModel';

type UpcomingListProps = {
  upcoming: readonly UpcomingAssessment[];
  orphans: readonly EntryRecord[];
  onOpenAssessment: (assessment: UpcomingAssessment) => void;
  onOpenOrphan: (record: EntryRecord) => void;
};

/** Kolokwia and exams of the next 14 days, and entries without a class. */
export function UpcomingList({
  upcoming,
  orphans,
  onOpenAssessment,
  onOpenOrphan,
}: UpcomingListProps) {
  return (
    <>
      {upcoming.length === 0 ? (
        <p className="details-empty">Nic w najbliższych 14 dniach</p>
      ) : (
        <ol className="upcoming-list">
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
    </>
  );
}

/** "Nadchodzące" next to the calendar on wide screens. */
export function UpcomingPanel(props: UpcomingListProps) {
  return (
    <section className="upcoming-panel" aria-labelledby="upcoming-title">
      <div className="details-heading">
        <p className="eyebrow">NAJBLIŻSZE 14 DNI</p>
        <h2 id="upcoming-title">Nadchodzące</h2>
      </div>
      <UpcomingList {...props} />
    </section>
  );
}

type UpcomingBarProps = {
  upcoming: readonly UpcomingAssessment[];
  orphans: readonly EntryRecord[];
  onOpen: () => void;
};

/**
 * One line above the calendar on narrow screens: the nearest kolokwium or
 * exam, or the entries that lost their class. Hidden when there is none.
 */
export function UpcomingBar({ upcoming, orphans, onOpen }: UpcomingBarProps) {
  const [nearest] = upcoming;
  if (!nearest && orphans.length === 0) {
    return null;
  }

  return (
    <button
      aria-haspopup="dialog"
      className={`upcoming-bar upcoming-bar-${nearest?.assessment.kind ?? 'orphans'}`}
      type="button"
      onClick={onOpen}
    >
      <span className="visually-hidden">Nadchodzące: </span>
      {nearest ? (
        <span className="upcoming-bar-text">
          <span aria-hidden="true">
            {assessmentKindMarks[nearest.assessment.kind]}
          </span>{' '}
          <strong>
            {countdownLabel(nearest.daysLeft)} {nearest.start.toFormat('HH:mm')}
          </strong>{' '}
          · {nearest.assessment.title}: {nearest.assessment.subject}
        </span>
      ) : (
        <span className="upcoming-bar-text">
          <span aria-hidden="true">!</span> {orphanCountLabel(orphans.length)}
        </span>
      )}
      {upcoming.length > 1 && (
        <span className="upcoming-bar-count">
          +{upcoming.length - 1}
          <span className="visually-hidden"> więcej</span>
        </span>
      )}
      {nearest && orphans.length > 0 && (
        <span className="upcoming-bar-count upcoming-bar-orphans">
          <span aria-hidden="true">!</span> {orphans.length}
          <span className="visually-hidden"> bez terminu</span>
        </span>
      )}
      <span aria-hidden="true" className="upcoming-bar-chevron">
        ›
      </span>
    </button>
  );
}
