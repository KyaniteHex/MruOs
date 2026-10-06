import type { ScheduledAssessment } from '@mruos/shared';
import {
  assessmentKindLabels,
  assessmentKindMarks,
  reminderLabels,
} from './entryFormModel';

type AssessmentDetailsProps = {
  scheduled: ScheduledAssessment;
  onEdit: () => void;
};

/** Details of a kolokwium or an exam held at its own time. */
export function AssessmentDetails({
  scheduled,
  onEdit,
}: AssessmentDetailsProps) {
  const { assessment } = scheduled;

  return (
    <div className="event-details assessment-details">
      <span
        className={`event-type assessment-type assessment-type-${assessment.kind}`}
      >
        <span aria-hidden="true">{assessmentKindMarks[assessment.kind]}</span>{' '}
        {assessmentKindLabels[assessment.kind]}
      </span>
      <h3>
        {assessment.title}: {assessment.subject}
      </h3>
      <dl>
        <div>
          <dt>Data</dt>
          <dd>{scheduled.date}</dd>
        </div>
        <div>
          <dt>Godziny</dt>
          <dd>
            {scheduled.start.toFormat('HH:mm')}–
            {scheduled.end.toFormat('HH:mm')}
          </dd>
        </div>
        {scheduled.room && (
          <div>
            <dt>Sala</dt>
            <dd>{scheduled.room}</dd>
          </div>
        )}
        {scheduled.building && (
          <div>
            <dt>Budynek</dt>
            <dd>{scheduled.building}</dd>
          </div>
        )}
      </dl>
      {assessment.details && (
        <p className="assessment-text">{assessment.details}</p>
      )}
      <p className="field-hint">
        Przypomnienie:{' '}
        {assessment.reminders.length > 0
          ? assessment.reminders
              .map((reminder) => reminderLabels[reminder].toLowerCase())
              .join(', ')
          : 'brak'}
      </p>
      <div className="details-actions">
        <button className="secondary-button" type="button" onClick={onEdit}>
          Edytuj
        </button>
      </div>
    </div>
  );
}
