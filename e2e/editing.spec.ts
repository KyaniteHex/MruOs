import { expect, test } from '@playwright/test';
import {
  addClass,
  goToNextMonth,
  openDetails,
  register,
  reloadSignedIn,
} from './helpers';

async function editOccurrence(
  page: import('@playwright/test').Page,
  date: string,
  scope: 'Tylko ten termin' | 'Cała seria',
  room: string,
) {
  await openDetails(page, date, 'Bazy danych');
  await page
    .locator('.event-details')
    .getByRole('button', { name: 'Edytuj' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Edytuj zajęcia' });
  await dialog.getByLabel(scope).check();
  await dialog.getByLabel('Sala', { exact: true }).fill(room);
  await dialog.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await register(page);
  await addClass(page, { subject: 'Bazy danych', weekday: 'Wt', room: '101' });
  await goToNextMonth(page);
});

test('changes the room of a single occurrence only', async ({ page }) => {
  await editOccurrence(page, '2026-10-13', 'Tylko ten termin', '999');

  await expect(
    await openDetails(page, '2026-10-13', 'Bazy danych'),
  ).toContainText('999');
  await expect(
    await openDetails(page, '2026-10-06', 'Bazy danych'),
  ).toContainText('101');
  await expect(
    await openDetails(page, '2026-10-20', 'Bazy danych'),
  ).toContainText('101');
});

test('changes the whole series and keeps single-occurrence changes', async ({
  page,
}) => {
  await editOccurrence(page, '2026-10-13', 'Tylko ten termin', '999');
  await editOccurrence(page, '2026-10-20', 'Cała seria', '500');

  for (const date of ['2026-10-06', '2026-10-20', '2026-10-27']) {
    await expect(await openDetails(page, date, 'Bazy danych')).toContainText(
      '500',
    );
  }
  await expect(
    await openDetails(page, '2026-10-13', 'Bazy danych'),
  ).toContainText('999');

  await reloadSignedIn(page);
  await goToNextMonth(page);
  await expect(
    await openDetails(page, '2026-10-27', 'Bazy danych'),
  ).toContainText('500');
});
