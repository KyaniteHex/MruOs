import { dayCell, expect, openAsGuest, showMonth, test } from './helpers';

// Uses the demo plan shown to visitors without an account; the clock says
// Wednesday 30 September 2026.
test.beforeEach(async ({ page }) => {
  await openAsGuest(page);
});

test('opens on the current week and moves between weeks', async ({ page }) => {
  const title = page.locator('#calendar-title');
  await expect(title).toHaveText('28 września – 2 października 2026');
  await expect(page.getByText('tydzień 1 semestru')).toBeVisible();
  await expect(
    page.locator('.fc-timeGridWeek-view .fc-event', {
      hasText: 'Programowanie',
    }),
  ).toContainText('Laboratorium · s. Lab 3');

  await page.getByRole('button', { name: 'Następny' }).click();
  await expect(title).toHaveText('5–9 października 2026');
  await expect(page.getByText('tydzień 2 semestru')).toBeVisible();

  await page.getByRole('button', { name: 'Dziś' }).click();
  await expect(title).toHaveText('28 września – 2 października 2026');
});

test('moves between months', async ({ page }) => {
  const title = page.locator('#calendar-title');
  await showMonth(page);
  await expect(title).toHaveText('Wrzesień 2026');

  await page.getByRole('button', { name: 'Następny' }).click();
  await expect(title).toHaveText('Październik 2026');
  await expect(dayCell(page, '2026-10-15')).toBeVisible();

  await page.getByRole('button', { name: 'Poprzedni' }).click();
  await page.getByRole('button', { name: 'Poprzedni' }).click();
  await expect(title).toHaveText('Sierpień 2026');
});

test('opens the day view with hours and class details', async ({ page }) => {
  await showMonth(page);
  await dayCell(page, '2026-09-30').locator('.fc-daygrid-day-number').click();

  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible();
  await expect(page.locator('#calendar-title')).toHaveText(
    'Środa, 30 września 2026',
  );
  // Hours fit the plan: its classes run from 8:00 to 14:00.
  const slotLabels = page.locator('.fc-timegrid-slot-label[data-time]');
  await expect(slotLabels.first()).toHaveAttribute('data-time', '08:00:00');
  await expect(slotLabels.last()).toHaveAttribute('data-time', '13:00:00');

  const classBlock = page.locator('.fc-event', { hasText: 'Programowanie' });
  await expect(classBlock).toContainText('11:00–13:00');
  await classBlock.click();
  await expect(page.locator('.event-details')).toContainText('2026-09-30');
  await expect(classBlock).toHaveClass(/is-selected/);

  await page.getByRole('button', { name: 'Miesiąc', exact: true }).click();
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible();
});
