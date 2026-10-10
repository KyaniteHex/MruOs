import type { Page } from '@playwright/test';
import {
  addClass,
  expect,
  openDetails,
  openSettings,
  register,
  showMonth,
  test,
} from './helpers';

// Calendar files fold long lines; joining them back gives the text.
async function fetchFeed(page: Page, link: string) {
  const response = await page.request.get(link);
  return {
    status: response.status(),
    type: response.headers()['content-type'] ?? '',
    text: (await response.text()).replace(/\r\n[ \t]/g, ''),
  };
}

test('subscribes to the plan with a secret link', async ({ page }) => {
  await register(page);
  await addClass(page, { subject: 'Algorytmy', weekday: 'Wt' });
  await showMonth(page);
  const details = await openDetails(page, '2026-09-29', 'Algorytmy');
  await details.getByRole('button', { name: '+ Kolokwium' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Dodaj kolokwium lub egzamin',
  });
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(dialog).toBeHidden();

  await openSettings(page);
  await page.getByRole('button', { name: 'Utwórz link' }).click();
  const linkField = page.getByLabel('Link subskrypcji');
  const firstLink = await linkField.inputValue();
  expect(firstLink).toMatch(/\/api\/ical\/[\w-]{43}\.ics$/);

  const feed = await fetchFeed(page, firstLink);
  expect(feed.status).toBe(200);
  expect(feed.type).toContain('text/calendar');
  expect(feed.text).toContain('SUMMARY:⚑ Algorytmy · Kolokwium');

  // A new link replaces the old one at once.
  await page.getByRole('button', { name: 'Wygeneruj nowy link' }).click();
  await expect(linkField).not.toHaveValue(firstLink);
  const secondLink = await linkField.inputValue();
  expect((await fetchFeed(page, firstLink)).status).toBe(404);
  expect((await fetchFeed(page, secondLink)).status).toBe(200);

  await page.getByRole('button', { name: 'Wyłącz subskrypcję' }).click();
  await expect(page.getByRole('button', { name: 'Utwórz link' })).toBeVisible();
  expect((await fetchFeed(page, secondLink)).status).toBe(404);
});
