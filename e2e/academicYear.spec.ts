import { expect, test } from '@playwright/test';
import {
  dayCell,
  fillUmkWinterSemester,
  goToNextMonth,
  openAsGuest,
} from './helpers';

const pharmacyPlan = 'e2e/fixtures/plans/260922_Farmacja_rok5_sem9.xlsx';

test('dates an imported timetable by the academic calendar', async ({
  page,
}) => {
  await openAsGuest(page);
  await page.getByRole('button', { name: 'Rok akademicki' }).click();
  const settings = page.getByRole('dialog', { name: 'Rok akademicki' });

  // Statutory holidays are listed before anything is typed.
  await expect(
    settings.getByLabel('Data: Narodowe Święto Niepodległości'),
  ).toHaveValue('2026-11-11');
  await fillUmkWinterSemester(settings);
  await settings.getByRole('button', { name: 'Zapisz harmonogram' }).click();
  await expect(settings).toBeHidden();
  // The demo plan keeps its dates, and the app says so.
  await expect(
    page.getByRole('status').filter({ hasText: 'zachowują swoje daty' }),
  ).toBeVisible();

  // Days off and breaks are shown in the calendar.
  await goToNextMonth(page);
  const holiday = dayCell(page, '2026-11-11').getByTitle(
    'Dzień wolny: Narodowe Święto Niepodległości',
  );
  await expect(holiday).toBeVisible();
  // The details panel shows names that narrow cells cut off.
  await holiday.click();
  await expect(page.locator('.event-details')).toContainText(
    'Narodowe Święto Niepodległości',
  );
  await goToNextMonth(page);
  await expect(
    dayCell(page, '2026-12-21').getByText('Wakacje zimowe'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Import z Excela' }).click();
  const importDialog = page.getByRole('dialog', { name: 'Import z Excela' });
  await importDialog
    .getByLabel('Plik planu (.xlsx)')
    .setInputFiles(pharmacyPlan);
  // "sem9" is a winter semester.
  await expect(importDialog.getByLabel('Semestr')).toHaveValue('winter');
  await importDialog
    .getByLabel('Grupa: Etyka zawodu · Ćwiczenia')
    .selectOption('3');
  await expect(importDialog.getByText(/Zmiana sali 2\.02/)).toHaveCount(0);
  await importDialog
    .getByLabel('Zastąp obecny plan zamiast dopisywać zajęcia')
    .check();
  await importDialog
    .getByRole('button', { name: /^Importuj \d+ zajęć$/ })
    .click();
  await expect(importDialog).toBeHidden();

  // Week 15 of Tuesday classes is 2.02.2027, the day of the room change.
  for (let month = 0; month < 4; month += 1) {
    await goToNextMonth(page);
  }
  await dayCell(page, '2027-02-02').locator('.fc-daygrid-day-number').click();
  await page
    .locator('.fc-event', { hasText: 'Etyka zawodu' })
    .filter({ hasText: '12:00' })
    .click();
  await expect(page.locator('.event-details')).toContainText('2027-02-02');
  await expect(page.locator('.event-details')).toContainText('-1.2');
});
