import type { AssessmentKind, EntryRecord } from '@mruos/shared';
import { entryMark, entryTitle } from './entryFormModel';

export type NewEntryKind = AssessmentKind | 'note';

type ClassEntriesProps = {
  /** Kolokwia, exams and notes of this class. */
  records: readonly EntryRecord[];
  /** Notes about the whole subject. */
  subjectNotes: readonly EntryRecord[];
  onAdd: (kind: NewEntryKind) => void;
  onEdit: (record: EntryRecord) => void;
};

function entryText(record: EntryRecord): string | undefined {
  const { entry } = record;
  return entry.kind === 'note' ? entry.text : entry.details;
}

/** The entries part of a class's details, with buttons to add more. */
export function ClassEntries({
  records,
  subjectNotes,
  onAdd,
  onEdit,
}: ClassEntriesProps) {
  const all = [...records, ...subjectNotes];

  return (
    <section
      className="class-entries"
      aria-label="Kolokwia, egzaminy i notatki"
    >
      {all.length > 0 && (
        <ul className="entry-list">
          {all.map((record) => {
            const title = entryTitle(record.entry);
            const text = entryText(record);
            return (
              <li
                className={`entry-item entry-item-${record.entry.kind}`}
                key={record.id}
              >
                <span className="entry-mark" aria-hidden="true">
                  {entryMark(record.entry)}
                </span>
                <div className="entry-copy">
                  <strong>{title}</strong>
                  {text && <p>{text}</p>}
                </div>
                <button
                  aria-label={`Edytuj: ${title}`}
                  className="text-button"
                  type="button"
                  onClick={() => onEdit(record)}
                >
                  Edytuj
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="entry-add">
        <button
          className="text-button"
          type="button"
          onClick={() => onAdd('test')}
        >
          + Kolokwium
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => onAdd('exam')}
        >
          + Egzamin
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => onAdd('note')}
        >
          + Notatka
        </button>
      </div>
    </section>
  );
}
