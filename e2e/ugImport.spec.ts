import {
  chooseInSettings,
  closeSheet,
  eventOn,
  expect,
  fillUgWinterSemester,
  goToNextMonth,
  openAsGuest,
  openDetails,
  openSettings,
  showMonth,
  test,
} from './helpers';

const plan = 'e2e/fixtures/plans/15-09-2026-ssl-ek-1.pdf';

test('imports a UG timetable from PDF by its I and II weeks', async ({
  page,
}) => {
  await openAsGuest(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Ustaw harmonogram' }).click();
  const settings = page.getByRole('dialog', { name: 'Rok akademicki' });
  await fillUgWinterSemester(settings);
  await settings.getByRole('button', { name: 'Zapisz harmonogram' }).click();
  await expect(settings).toBeHidden();

  await chooseInSettings(page, 'Import', 'Format PDF (UG)');
  const dialog = page.getByRole('dialog', { name: 'Import z PDF (UG)' });
  await dialog.getByLabel('Plik planu (.pdf)').setInputFiles(plan);
  await expect(
    dialog.getByText(
      'Wydział Ekonomiczny UG · 1 SS1 EK · semestr zimowy 2026/2027 · wersja z 15 IX',
    ),
  ).toBeVisible();
  await dialog.getByLabel('Twoja grupa').selectOption('B');
  await dialog
    .getByLabel('Zastąp obecny plan zamiast dopisywać zajęcia')
    .check();
  // Seven classes for the whole year and two of group B; the language
  // blocks are left out.
  await dialog.getByRole('button', { name: 'Importuj 9 zajęć' }).click();
  await expect(dialog).toBeHidden();

  await showMonth(page);
  await expect(page.locator('#calendar-title')).toHaveText('Październik 2026');
  // "I tydzień" on Wednesdays: odd calendar weeks, so from 14.10.
  await expect(
    eventOn(page, '2026-10-07', 'Własność intelektualna'),
  ).toHaveCount(0);
  await expect(
    eventOn(page, '2026-10-14', 'Własność intelektualna'),
  ).toBeVisible();
  // The meeting is on 5.10 only.
  await expect(eventOn(page, '2026-10-05', 'Spotkanie')).toBeVisible();
  await expect(eventOn(page, '2026-10-19', 'Spotkanie')).toHaveCount(0);

  const project = await openDetails(page, '2026-10-23', 'Blok projektowy');
  await expect(project).toContainText('C301');
  const exercises = await openDetails(page, '2026-10-15', 'Makroekonomia I');
  await expect(exercises).toContainText('Neumann (Dr Lilia)');
  await closeSheet(page);

  // On Thursday 28.01 classes follow the Monday plan.
  for (let month = 0; month < 3; month += 1) {
    await goToNextMonth(page);
  }
  await expect(page.locator('#calendar-title')).toHaveText('Styczeń 2027');
  await expect(eventOn(page, '2027-01-28', 'Zarządzanie')).toBeVisible();
  await expect(eventOn(page, '2027-01-21', 'Zarządzanie')).toHaveCount(0);
  await expect(eventOn(page, '2027-01-28', 'Makroekonomia I')).toHaveCount(0);
});
