import { expect, test } from '@playwright/test';
import { dayCell } from './helpers';

// Uses the demo plan shown to visitors who are not logged in.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('moves between months', async ({ page }) => {
  const title = page.locator('.fc-toolbar-title');
  await expect(title).toHaveText(/wrzesień 2026/i);

  await page.locator('.fc-next-button').click();
  await expect(title).toHaveText(/październik 2026/i);
  await expect(dayCell(page, '2026-10-15')).toBeVisible();

  await page.locator('.fc-prev-button').click();
  await page.locator('.fc-prev-button').click();
  await expect(title).toHaveText(/sierpień 2026/i);
});

test('opens the day view with hours and class details', async ({ page }) => {
  await dayCell(page, '2026-09-30').locator('.fc-daygrid-day-number').click();

  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible();
  await expect(page.locator('.fc-toolbar-title')).toHaveText(
    /30 września 2026/i,
  );
  const slotLabels = page.locator('.fc-timegrid-slot-label[data-time]');
  await expect(slotLabels.first()).toHaveAttribute('data-time', '07:00:00');
  await expect(slotLabels.last()).toHaveAttribute('data-time', '20:00:00');

  const classBlock = page.locator('.fc-event', { hasText: 'Programowanie' });
  await expect(classBlock).toContainText('11:00');
  await classBlock.click();
  await expect(page.locator('.event-details')).toContainText('2026-09-30');

  await page.getByRole('button', { name: 'Miesiąc' }).click();
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible();
});
