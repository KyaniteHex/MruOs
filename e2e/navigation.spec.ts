import {
  dayCell,
  expect,
  isNarrow,
  openAsGuest,
  openSettings,
  showMonth,
  test,
} from './helpers';

// Uses the demo plan shown to visitors without an account; the clock says
// Wednesday 30 September 2026.
test.beforeEach(async ({ page }) => {
  await openAsGuest(page);
});

test('opens on the current week and moves between weeks', async ({ page }) => {
  const title = page.locator('#calendar-title');
  await expect(title).toHaveText('28 września – 4 października 2026');
  await expect(page.getByText('tydzień 1 semestru')).toBeVisible();
  await expect(
    page.locator('.fc-timeGridWeek-view .fc-event', {
      hasText: 'Programowanie',
    }),
  ).toContainText('Laboratorium · s. Lab 3');

  await page.getByRole('button', { name: 'Następny' }).click();
  await expect(title).toHaveText('5–11 października 2026');
  await expect(page.getByText('tydzień 2 semestru')).toBeVisible();

  await page.getByRole('button', { name: 'Dziś' }).click();
  await expect(title).toHaveText('28 września – 4 października 2026');
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

  await showMonth(page);
});

test('fits the calendar to the screen in every view', async ({ page }) => {
  const screenHeight = page.viewportSize()?.height ?? 0;
  for (const view of ['Tydzień', 'Miesiąc', 'Dzień']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    const box = await page.locator('.calendar-panel').boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? Infinity)).toBeLessThanOrEqual(
      screenHeight + 1,
    );
  }
});

test('shows the all-day row only in weeks with days off', async ({ page }) => {
  await expect(page.getByText('cały dzień')).toHaveCount(0);

  // 11 November is a day off of the demo semester.
  for (let week = 0; week < 6; week += 1) {
    await page.getByRole('button', { name: 'Następny' }).click();
  }
  await expect(page.locator('#calendar-title')).toHaveText(
    '9–15 listopada 2026',
  );
  await expect(page.getByText('cały dzień')).toBeVisible();
  await expect(page.locator('.calendar-annotation-day-off')).toHaveText(
    'Dzień wolny',
  );
});

test('shows details in a sheet over the calendar on phones', async ({
  page,
}) => {
  test.skip(!isNarrow(page), 'Wide screens show details next to it.');
  const classBlock = page.locator('.fc-event', { hasText: 'Programowanie' });
  const sheet = page.getByRole('dialog', { name: 'Szczegóły' });

  await classBlock.click();
  await expect(sheet).toContainText('Programowanie');
  await expect(sheet).toContainText('2026-09-30');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(classBlock).not.toHaveClass(/is-selected/);

  // A tap above the sheet closes it too.
  await classBlock.click();
  await expect(sheet).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(sheet).toBeHidden();
});

test('keeps menus on the screen', async ({ page }) => {
  const screenWidth = page.viewportSize()?.width ?? 0;
  async function expectMenuOnScreen(button: string) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const box = await page.getByRole('menu').boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? Infinity)).toBeLessThanOrEqual(
      screenWidth,
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  }

  await expectMenuOnScreen('+ Dodaj');
  await openSettings(page);
  await expectMenuOnScreen('Import');
  await expectMenuOnScreen('Eksport');
});

test('shows which versions of the app and the API run', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('.settings-version')).toHaveText(
    /^Wersja aplikacji: [0-9a-f]{7}.* · API: [0-9a-f]{7}$/,
  );
});
