import ICAL from 'ical.js';
import { expandOccurrences } from '@mruos/shared/recurrence';
import type { EventSeries } from './eventRepository';

export function exportCalendarIcs(
  series: readonly EventSeries[],
  daysOff: readonly string[],
): string {
  const calendar = new ICAL.Component('vcalendar');
  const timestamp = ICAL.Time.fromJSDate(new Date(), true);

  calendar.addPropertyWithValue('prodid', '-//MruOS//Student Schedule//PL');
  calendar.addPropertyWithValue('version', '2.0');
  calendar.addPropertyWithValue('calscale', 'GREGORIAN');

  for (const eventSeries of series) {
    const occurrences = expandOccurrences(
      eventSeries.event,
      eventSeries.event.recurrence,
      { daysOff: [...daysOff] },
    );

    for (const occurrence of occurrences) {
      const event = new ICAL.Component('vevent');

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
      event.addPropertyWithValue(
        'description',
        `Typ zajęć: ${occurrence.event.classType}`,
      );

      calendar.addSubcomponent(event);
    }
  }

  return calendar.toString();
}
