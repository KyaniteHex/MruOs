import ICAL from 'ical.js';
import { classKey, placeEntries } from '@mruos/shared';
import type { CalendarSnapshot, EntryRecord } from '@mruos/shared';
import { expandOccurrences } from '@mruos/shared/recurrence';
import { assessmentKindLabels } from './entryFormModel';
import { classTypeLabels } from './eventFormModel';

export type IcsOptions = {
  /** Kolokwia and exams as events of their own, with their reminders. */
  assessments: boolean;
  /** Notes in the descriptions of their classes. */
  notes: boolean;
};

function noteTexts(records: readonly EntryRecord[] | undefined): string[] {
  return (records ?? []).flatMap(({ entry }) =>
    entry.kind === 'note' ? [entry.text] : [],
  );
}

export function exportCalendarIcs(
  snapshot: CalendarSnapshot,
  options: IcsOptions = { assessments: true, notes: true },
): string {
  const calendar = new ICAL.Component('vcalendar');
  const timestamp = ICAL.Time.fromJSDate(new Date(), true);
  const placed = placeEntries(
    snapshot.entries,
    snapshot.events,
    snapshot.semester,
  );

  calendar.addPropertyWithValue('prodid', '-//MruOS//Student Schedule//PL');
  calendar.addPropertyWithValue('version', '2.0');
  calendar.addPropertyWithValue('calscale', 'GREGORIAN');

  for (const eventSeries of snapshot.events) {
    const occurrences = expandOccurrences(
      eventSeries.event,
      eventSeries.event.recurrence,
      snapshot.semester,
    );

    for (const occurrence of occurrences) {
      const event = new ICAL.Component('vevent');
      const description = [
        `Typ zajęć: ${classTypeLabels[occurrence.event.classType]}`,
      ];
      if (options.notes) {
        description.push(
          ...noteTexts(
            placed.byClass.get(classKey(eventSeries.id, occurrence.date)),
          ).map((text) => `Notatka: ${text}`),
          ...noteTexts(placed.subjectNotes.get(occurrence.event.subject)).map(
            (text) => `Notatka do przedmiotu: ${text}`,
          ),
        );
      }

      event.addPropertyWithValue(
        'uid',
        `${eventSeries.id}-${occurrence.date}@mruos`,
      );
      event.addPropertyWithValue('dtstamp', timestamp.clone());
      event.addPropertyWithValue(
        'dtstart',
        ICAL.Time.fromJSDate(occurrence.start.toJSDate(), true),
      );
      event.addPropertyWithValue(
        'dtend',
        ICAL.Time.fromJSDate(occurrence.end.toJSDate(), true),
      );
      event.addPropertyWithValue('summary', occurrence.event.subject);
      event.addPropertyWithValue(
        'location',
        `${occurrence.event.building}, ${occurrence.event.room}`,
      );
      event.addPropertyWithValue('description', description.join('\n'));

      calendar.addSubcomponent(event);
    }
  }

  if (options.assessments) {
    for (const scheduled of placed.assessments) {
      const { assessment } = scheduled;
      const event = new ICAL.Component('vevent');
      const summary = `${assessment.title}: ${assessment.subject}`;
      const location = [scheduled.building, scheduled.room]
        .filter(Boolean)
        .join(', ');

      event.addPropertyWithValue('uid', `entry-${scheduled.id}@mruos`);
      event.addPropertyWithValue('dtstamp', timestamp.clone());
      event.addPropertyWithValue(
        'dtstart',
        ICAL.Time.fromJSDate(scheduled.start.toJSDate(), true),
      );
      event.addPropertyWithValue(
        'dtend',
        ICAL.Time.fromJSDate(scheduled.end.toJSDate(), true),
      );
      event.addPropertyWithValue('summary', summary);
      if (location) {
        event.addPropertyWithValue('location', location);
      }
      event.addPropertyWithValue(
        'description',
        [assessmentKindLabels[assessment.kind], assessment.details]
          .filter(Boolean)
          .join('\n'),
      );

      for (const reminder of assessment.reminders) {
        const alarm = new ICAL.Component('valarm');
        alarm.addPropertyWithValue('action', 'DISPLAY');
        alarm.addPropertyWithValue('description', summary);
        alarm.addPropertyWithValue(
          'trigger',
          ICAL.Duration.fromString(`-${reminder}`),
        );
        event.addSubcomponent(alarm);
      }

      calendar.addSubcomponent(event);
    }
  }

  return calendar.toString();
}
