import ICAL from 'ical.js';
import { dayAfter, semesterAnnotations } from './academicYear.js';
import { classKey, placeEntries } from './entries.js';
import {
  assessmentKindLabels,
  assessmentKindMarks,
  classTypeLabels,
} from './labels.js';
import { expandOccurrences } from './recurrence.js';
import type {
  Assessment,
  CalendarFeedOptions,
  CalendarSnapshot,
  EntryRecord,
  Reminder,
} from './types.js';

/** A subscription starts with kolokwia and exams only. */
export const defaultFeedOptions: CalendarFeedOptions = {
  assessments: true,
  notes: false,
  daysOff: false,
  periods: false,
};

function noteTexts(records: readonly EntryRecord[] | undefined): string[] {
  return (records ?? []).flatMap(({ entry }) =>
    entry.kind === 'note' ? [entry.text] : [],
  );
}

/** "★ ⚑" for a class with both an exam and a kolokwium. */
function marksOf(assessments: readonly Assessment[]): string {
  return (['exam', 'test'] as const)
    .filter((kind) =>
      assessments.some((assessment) => assessment.kind === kind),
    )
    .map((kind) => assessmentKindMarks[kind])
    .join(' ');
}

function addAlarms(
  event: ICAL.Component,
  reminders: readonly Reminder[],
  summary: string,
) {
  for (const reminder of new Set(reminders)) {
    const alarm = new ICAL.Component('valarm');
    alarm.addPropertyWithValue('action', 'DISPLAY');
    alarm.addPropertyWithValue('description', summary);
    alarm.addPropertyWithValue(
      'trigger',
      ICAL.Duration.fromString(`-${reminder}`),
    );
    event.addSubcomponent(alarm);
  }
}

function addAllDayEvent(
  calendar: ICAL.Component,
  stamp: ICAL.Time,
  uid: string,
  summary: string,
  startDate: string,
  endDate: string,
) {
  const event = new ICAL.Component('vevent');
  event.addPropertyWithValue('uid', uid);
  event.addPropertyWithValue('dtstamp', stamp.clone());
  event.addPropertyWithValue('dtstart', ICAL.Time.fromDateString(startDate));
  // All-day events end on the following day, exclusively.
  event.addPropertyWithValue(
    'dtend',
    ICAL.Time.fromDateString(dayAfter(endDate)),
  );
  event.addPropertyWithValue('summary', summary);
  // Shown as free time, so they do not block the day.
  event.addPropertyWithValue('transp', 'TRANSPARENT');
  calendar.addSubcomponent(event);
}

/**
 * The plan as an iCalendar file, for download and for subscriptions. A
 * kolokwium or an exam during a class becomes part of that class's event;
 * those at their own time are events of their own.
 */
export function calendarIcs(
  snapshot: CalendarSnapshot,
  options: CalendarFeedOptions,
): string {
  const calendar = new ICAL.Component('vcalendar');
  const stamp = ICAL.Time.fromJSDate(new Date(), true);
  const placed = placeEntries(
    snapshot.entries,
    snapshot.events,
    snapshot.semester,
  );

  calendar.addPropertyWithValue('prodid', '-//MruOS//Student Schedule//PL');
  calendar.addPropertyWithValue('version', '2.0');
  calendar.addPropertyWithValue('calscale', 'GREGORIAN');
  // The name a calendar app gives a subscription.
  calendar.addPropertyWithValue('x-wr-calname', 'MruOS');

  for (const series of snapshot.events) {
    const occurrences = expandOccurrences(
      series.event,
      series.event.recurrence,
      snapshot.semester,
    );

    for (const occurrence of occurrences) {
      const records = placed.byClass.get(classKey(series.id, occurrence.date));
      const assessments = options.assessments
        ? (records ?? []).flatMap(({ entry }) =>
            entry.kind === 'note' ? [] : [entry],
          )
        : [];
      const { subject } = occurrence.event;
      const summary =
        assessments.length > 0
          ? `${marksOf(assessments)} ${subject} · ${assessments
              .map((assessment) => assessment.title)
              .join(', ')}`
          : subject;
      const description = [
        `Typ zajęć: ${classTypeLabels[occurrence.event.classType]}`,
        ...assessments.map((assessment) =>
          assessment.details
            ? `${assessment.title}: ${assessment.details}`
            : assessment.title,
        ),
      ];
      if (options.notes) {
        description.push(
          ...noteTexts(records).map((text) => `Notatka: ${text}`),
          ...noteTexts(placed.subjectNotes.get(subject)).map(
            (text) => `Notatka do przedmiotu: ${text}`,
          ),
        );
      }

      const event = new ICAL.Component('vevent');
      event.addPropertyWithValue(
        'uid',
        `${series.id}-${occurrence.date}@mruos`,
      );
      event.addPropertyWithValue('dtstamp', stamp.clone());
      event.addPropertyWithValue(
        'dtstart',
        ICAL.Time.fromJSDate(occurrence.start.toJSDate(), true),
      );
      event.addPropertyWithValue(
        'dtend',
        ICAL.Time.fromJSDate(occurrence.end.toJSDate(), true),
      );
      event.addPropertyWithValue('summary', summary);
      event.addPropertyWithValue(
        'location',
        `${occurrence.event.building}, ${occurrence.event.room}`,
      );
      event.addPropertyWithValue('description', description.join('\n'));
      addAlarms(
        event,
        assessments.flatMap((assessment) => assessment.reminders),
        summary,
      );
      calendar.addSubcomponent(event);
    }
  }

  if (options.assessments) {
    for (const scheduled of placed.assessments) {
      if (scheduled.seriesId) {
        continue;
      }

      const { assessment } = scheduled;
      const summary = `${assessmentKindMarks[assessment.kind]} ${assessment.title}: ${assessment.subject}`;
      const location = [scheduled.building, scheduled.room]
        .filter(Boolean)
        .join(', ');
      const event = new ICAL.Component('vevent');

      event.addPropertyWithValue('uid', `entry-${scheduled.id}@mruos`);
      event.addPropertyWithValue('dtstamp', stamp.clone());
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
      addAlarms(event, assessment.reminders, summary);
      calendar.addSubcomponent(event);
    }
  }

  const annotationUids = new Set<string>();
  for (const annotation of semesterAnnotations(snapshot.semester)) {
    const isDayOff = annotation.kind === 'day-off';
    if (isDayOff ? !options.daysOff : !options.periods) {
      continue;
    }

    // Stable between refreshes, so calendars update events in place.
    const base = `${annotation.kind}-${annotation.startDate}-${annotation.endDate}`;
    let uid = `${base}@mruos`;
    for (let copy = 2; annotationUids.has(uid); copy += 1) {
      uid = `${base}-${copy}@mruos`;
    }
    annotationUids.add(uid);

    addAllDayEvent(
      calendar,
      stamp,
      uid,
      isDayOff && annotation.label !== 'Dzień wolny'
        ? `Dzień wolny: ${annotation.label}`
        : annotation.label,
      annotation.startDate,
      annotation.endDate,
    );
  }

  return calendar.toString();
}
