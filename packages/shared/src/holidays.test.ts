import { describe, expect, it } from 'vitest';
import { easterSunday, polishPublicHolidays } from './holidays.js';

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'],
  ])('finds Easter of %i', (year, date) => {
    expect(easterSunday(year).toISODate()).toBe(date);
  });
});

describe('polishPublicHolidays', () => {
  it('lists the statutory holidays of the 2026/2027 academic year', () => {
    expect(polishPublicHolidays(2026)).toEqual([
      { date: '2026-11-01', label: 'Wszystkich Świętych' },
      { date: '2026-11-11', label: 'Narodowe Święto Niepodległości' },
      { date: '2026-12-24', label: 'Wigilia Bożego Narodzenia' },
      { date: '2026-12-25', label: 'Pierwszy dzień Bożego Narodzenia' },
      { date: '2026-12-26', label: 'Drugi dzień Bożego Narodzenia' },
      { date: '2027-01-01', label: 'Nowy Rok' },
      { date: '2027-01-06', label: 'Święto Trzech Króli' },
      { date: '2027-03-28', label: 'Pierwszy dzień Wielkiej Nocy' },
      { date: '2027-03-29', label: 'Drugi dzień Wielkiej Nocy' },
      { date: '2027-05-01', label: 'Święto Pracy' },
      { date: '2027-05-03', label: 'Święto Konstytucji 3 Maja' },
      {
        date: '2027-05-16',
        label: 'Zesłanie Ducha Świętego (Zielone Świątki)',
      },
      { date: '2027-05-27', label: 'Boże Ciało' },
      { date: '2027-08-15', label: 'Wniebowzięcie Najświętszej Maryi Panny' },
    ]);
  });

  it('omits Christmas Eve before it became a day off in 2025', () => {
    const dates = polishPublicHolidays(2024).map((holiday) => holiday.date);

    expect(dates).not.toContain('2024-12-24');
    expect(dates).toContain('2025-04-21');
  });
});
