import { expect, test } from '@playwright/test';
import { addClass, eventOn, goToNextMonth, register } from './helpers';

// A fresh account starts with an empty plan; the calendar opens on the
// semester start, Monday 2026-09-28.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await register(page);
});

test('shows a weekly class on every Tuesday and keeps it after reload', async ({
  page,
}) => {
  await addClass(page, { subject: 'Algorytmy', weekday: 'Wt' });

  await expect(eventOn(page, '2026-09-29', 'Algorytmy')).toBeVisible();
  await expect(eventOn(page, '2026-09-30', 'Algorytmy')).toHaveCount(0);

  await goToNextMonth(page);
  for (const date of ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']) {
    await expect(eventOn(page, date, 'Algorytmy')).toBeVisible();
  }

  await page.reload();
  await expect(eventOn(page, '2026-09-29', 'Algorytmy')).toBeVisible();
});

test('shows an every-other-week class only in alternate weeks', async ({
  page,
}) => {
  await addClass(page, {
    subject: 'Laboratorium sieci',
    weekday: 'Czw',
    everyOtherWeek: true,
  });
  await goToNextMonth(page);

  await expect(eventOn(page, '2026-10-01', 'Laboratorium sieci')).toBeVisible();
  await expect(eventOn(page, '2026-10-08', 'Laboratorium sieci')).toHaveCount(
    0,
  );
  await expect(eventOn(page, '2026-10-15', 'Laboratorium sieci')).toBeVisible();
  await expect(eventOn(page, '2026-10-22', 'Laboratorium sieci')).toHaveCount(
    0,
  );
});
