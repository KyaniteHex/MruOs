import {
  chooseInSettings,
  eventOn,
  expect,
  goToNextMonth,
  openAsGuest,
  showMonth,
  test,
} from './helpers';

const plan = 'e2e/fixtures/plans/260922_Kosmetologia_st2_rok2_sem3.xlsx';

test('imports a faculty timetable for the chosen groups', async ({ page }) => {
  await openAsGuest(page);
  await chooseInSettings(page, 'Import', 'Format XLSX (UMK CM)');
  const dialog = page.getByRole('dialog', { name: 'Import z Excela' });

  await dialog.getByLabel('Plik planu (.xlsx)').setInputFiles(plan);
  await dialog.getByLabel('Początek semestru (tydzień 1)').fill('2026-10-05');
  await dialog
    .getByLabel(
      'Grupa: Kosmetologia z elementami SPA i Wellness · Laboratorium',
    )
    .selectOption('1');
  await dialog
    .getByLabel(
      'Grupa: Chirurgia plastyczna, rekonstrukcyjna i estetyczna · Ćwiczenia',
    )
    .selectOption('2');

  // The timetable gives no room for these classes, so the preview says so.
  await expect(
    dialog.getByText('Plan nie podaje sali. Uzupełnij ją po imporcie.').first(),
  ).toBeVisible();

  await dialog
    .getByLabel('Zastąp obecny plan zamiast dopisywać zajęcia')
    .check();
  await dialog.getByRole('button', { name: 'Importuj 8 zajęć' }).click();
  await expect(dialog).toBeHidden();

  // The calendar opens on the first imported week.
  await expect(page.locator('#calendar-title')).toHaveText(
    '5–11 października 2026',
  );
  await showMonth(page);
  // Lab for group 1 in weeks 1-5 on Mondays; the demo plan is replaced.
  await expect(
    eventOn(page, '2026-10-05', 'Kosmetologia z elementami SPA i Wellness'),
  ).toBeVisible();
  await expect(eventOn(page, '2026-10-05', 'Matematyka')).toHaveCount(0);
  await goToNextMonth(page);
  await expect(
    eventOn(page, '2026-11-02', 'Kosmetologia z elementami SPA i Wellness'),
  ).toBeVisible();
  await expect(
    eventOn(page, '2026-11-09', 'Kosmetologia z elementami SPA i Wellness'),
  ).toHaveCount(0);
});
