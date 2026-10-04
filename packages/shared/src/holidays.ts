import { DateTime } from 'luxon';
import type { AcademicDayOff } from './types.js';

/** Easter Sunday of the Gregorian calendar (Meeus/Jones/Butcher). */
export function easterSunday(year: number): DateTime {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return DateTime.fromObject({ year, month, day }, { zone: 'Europe/Warsaw' });
}

// Christmas Eve became a statutory day off in Poland in 2025.
const christmasEveFromYear = 2025;

function holidaysInYear(year: number): AcademicDayOff[] {
  const fixed = (month: number, day: number, label: string) => ({
    date:
      DateTime.fromObject(
        { year, month, day },
        { zone: 'Europe/Warsaw' },
      ).toISODate() ?? '',
    label,
  });
  const easter = easterSunday(year);
  const fromEaster = (days: number, label: string) => ({
    date: easter.plus({ days }).toISODate() ?? '',
    label,
  });

  return [
    fixed(1, 1, 'Nowy Rok'),
    fixed(1, 6, 'Święto Trzech Króli'),
    fromEaster(0, 'Pierwszy dzień Wielkiej Nocy'),
    fromEaster(1, 'Drugi dzień Wielkiej Nocy'),
    fixed(5, 1, 'Święto Pracy'),
    fixed(5, 3, 'Święto Konstytucji 3 Maja'),
    fromEaster(49, 'Zesłanie Ducha Świętego (Zielone Świątki)'),
    fromEaster(60, 'Boże Ciało'),
    fixed(8, 15, 'Wniebowzięcie Najświętszej Maryi Panny'),
    fixed(11, 1, 'Wszystkich Świętych'),
    fixed(11, 11, 'Narodowe Święto Niepodległości'),
    ...(year >= christmasEveFromYear
      ? [fixed(12, 24, 'Wigilia Bożego Narodzenia')]
      : []),
    fixed(12, 25, 'Pierwszy dzień Bożego Narodzenia'),
    fixed(12, 26, 'Drugi dzień Bożego Narodzenia'),
  ];
}

/**
 * Polish statutory holidays of an academic year, i.e. from 1 October of
 * `startYear` to 30 September of the following year.
 */
export function polishPublicHolidays(startYear: number): AcademicDayOff[] {
  const start = `${startYear}-10-01`;
  const end = `${startYear + 1}-09-30`;

  return [...holidaysInYear(startYear), ...holidaysInYear(startYear + 1)]
    .filter((holiday) => holiday.date >= start && holiday.date <= end)
    .sort((left, right) => left.date.localeCompare(right.date));
}
