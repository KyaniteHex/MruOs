import { expandOccurrences } from '@mruos/shared/recurrence';
import type { DateRange, Event, Semester } from '@mruos/shared';
import type { EventSeries } from './calendarEvents';

export type ScheduleConflict = {
    date: string;
    endTime: string;
    room: string;
    seriesId: string;
    subject: string;
    startTime: string;
};

export function findScheduleConflicts(
    candidate: Event,
    existingSeries: readonly EventSeries[],
    range: DateRange,
    semester: Pick<Semester, 'daysOff'>,
    excludedSeriesId?: string,
): ScheduleConflict[] {
    const candidateOccurrences = expandOccurrences(candidate, range, semester);
    const conflicts: ScheduleConflict[] = [];

    for (const series of existingSeries) {
        if (series.id === excludedSeriesId) {
            continue;
        }

        const existingOccurrences = expandOccurrences(
            series.event,
            range,
            semester,
        );

        for (const candidateOccurrence of candidateOccurrences) {
            for (const existingOccurrence of existingOccurrences) {
                if (
                    candidateOccurrence.date === existingOccurrence.date &&
                    candidateOccurrence.start < existingOccurrence.end &&
                    candidateOccurrence.end > existingOccurrence.start
                ) {
                    conflicts.push({
                        date: candidateOccurrence.date,
                        endTime: existingOccurrence.event.endTime,
                        room: existingOccurrence.event.room,
                        seriesId: series.id,
                        subject: existingOccurrence.event.subject,
                        startTime: existingOccurrence.event.startTime,
                    });
                }
            }
        }
    }

    return conflicts;
}
