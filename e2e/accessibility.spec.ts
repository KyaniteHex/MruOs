import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { contrastRatio } from '../packages/shared/src/color';
import { addClass, dayCell } from './helpers';

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
    let background = node as Element | null;
    let backgroundColor = 'rgba(0, 0, 0, 0)';
    // Walk up until an opaque background is found.
    while (background && backgroundColor === 'rgba(0, 0, 0, 0)') {
      backgroundColor = getComputedStyle(background).backgroundColor;
      background = background.parentElement;
    }

    return { text: getComputedStyle(text).color, backgroundColor };
  });

  return contrastRatio(toHex(colors.text), toHex(colors.backgroundColor));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('opens the day view and class details with the keyboard', async ({
  page,
}) => {
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
  await page.getByRole('button', { name: 'Dodaj zajęcia' }).focus();
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
  await dayCell(page, '2026-09-28').locator('.fc-daygrid-day-number').click();
  await expect(
    page.locator('.fc-event', { hasText: 'Ergonomia' }),
  ).toBeVisible();
});

test('keeps class text readable on light and dark user colors', async ({
  page,
}) => {
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

  for (const subject of ['Jasny kolor', 'Ciemny kolor']) {
    const monthEvent = dayCell(page, '2026-09-29').locator('.fc-event', {
      hasText: subject,
    });
    expect(await textContrast(monthEvent)).toBeGreaterThanOrEqual(4.5);
  }

  await dayCell(page, '2026-09-29').locator('.fc-daygrid-day-number').click();
  for (const subject of ['Jasny kolor', 'Ciemny kolor']) {
    const dayEvent = page.locator('.fc-event', { hasText: subject });
    expect(await textContrast(dayEvent)).toBeGreaterThanOrEqual(4.5);
  }
});
