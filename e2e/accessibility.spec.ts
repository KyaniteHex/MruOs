import type { Locator, Page } from '@playwright/test';
import { contrastRatio } from '../packages/shared/src/color';
import {
  addClass,
  dayCell,
  expect,
  openAsGuest,
  openSettings,
  showMonth,
  test,
} from './helpers';

function toHex(cssColor: string): string {
  const channels = cssColor.match(/\d+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Unexpected CSS color: ${cssColor}`);
  }

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

async function textContrast(element: Locator): Promise<number> {
  const colors = await element.evaluate((node) => {
    const text = node.querySelector('strong') ?? node;
    let background: Element | null = text;
    let backgroundColor = 'rgba(0, 0, 0, 0)';
    // Walk up from the text until an opaque background is found.
    while (background && backgroundColor === 'rgba(0, 0, 0, 0)') {
      backgroundColor = getComputedStyle(background).backgroundColor;
      background = background.parentElement;
    }

    return { text: getComputedStyle(text).color, backgroundColor };
  });

  return contrastRatio(toHex(colors.text), toHex(colors.backgroundColor));
}

async function expectReadableClasses(page: Page, subjects: string[]) {
  await showMonth(page);
  for (const subject of subjects) {
    const monthEvent = dayCell(page, '2026-09-29').locator('.fc-event', {
      hasText: subject,
    });
    expect(await textContrast(monthEvent)).toBeGreaterThanOrEqual(4.5);
  }

  await dayCell(page, '2026-09-29').locator('.fc-daygrid-day-number').click();
  for (const subject of subjects) {
    const dayEvent = page.locator('.fc-event', { hasText: subject });
    expect(await textContrast(dayEvent)).toBeGreaterThanOrEqual(4.5);
  }
}

test.beforeEach(async ({ page }) => {
  await openAsGuest(page);
});

test('opens the day view and class details with the keyboard', async ({
  page,
}) => {
  await showMonth(page);
  await dayCell(page, '2026-09-30').locator('.fc-daygrid-day-number').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible();

  await page.locator('.fc-event', { hasText: 'Programowanie' }).focus();
  await page.keyboard.press('Enter');
  const editButton = page
    .locator('.event-details')
    .getByRole('button', { name: 'Edytuj' });
  await expect(editButton).toBeVisible();

  await editButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edytuj zajęcia' });
  await expect(dialog.getByLabel('Przedmiot')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(editButton).toBeFocused();
});

test('adds a class using only the keyboard', async ({ page }) => {
  const addButton = page.getByRole('button', { name: '+ Dodaj' });
  await addButton.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Zajęcia' })).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Dodaj zajęcia' });
  await expect(dialog.getByLabel('Przedmiot')).toBeFocused();

  await page.keyboard.type('Ergonomia');
  await dialog.getByLabel('Budynek').focus();
  await page.keyboard.type('Wydział Zarządzania');
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Sala', { exact: true })).toBeFocused();
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  // Focus is back on the menu button the form was opened from.
  await expect(addButton).toBeFocused();
  await expect(
    page.locator('.fc-timeGridWeek-view .fc-event', { hasText: 'Ergonomia' }),
  ).toBeVisible();
});

test('keeps class text readable in both themes', async ({ page }) => {
  await addClass(page, {
    subject: 'Jasny kolor',
    weekday: 'Wt',
    color: '#ffeb3b',
  });
  await addClass(page, {
    subject: 'Ciemny kolor',
    weekday: 'Wt',
    color: '#1a237e',
  });
  const subjects = ['Jasny kolor', 'Ciemny kolor'];

  await expectReadableClasses(page, subjects);

  await openSettings(page);
  await page.getByLabel('Ciemny').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: '← Wróć do kalendarza' }).click();
  await expectReadableClasses(page, subjects);
});
