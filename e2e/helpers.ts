import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export const password = 'correct-horse-battery';

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.com`;
}

export async function register(page: Page, email = uniqueEmail()) {
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Zaloguj się' });
  await dialog.getByRole('button', { name: 'Utwórz konto' }).click();
  const registerDialog = page.getByRole('dialog', { name: 'Utwórz konto' });
  await registerDialog.getByLabel('E-mail').fill(email);
  await registerDialog.getByLabel('Hasło').fill(password);
  await registerDialog.getByRole('button', { name: 'Zarejestruj' }).click();
  // Password hashing makes registration slower than other requests.
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible({
    timeout: 15_000,
  });

  return email;
}

export async function login(page: Page, email: string, secret = password) {
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Zaloguj się' });
  await dialog.getByLabel('E-mail').fill(email);
  await dialog.getByLabel('Hasło').fill(secret);
  await dialog.getByRole('button', { name: 'Zaloguj' }).click();
}

type NewClass = {
  subject: string;
  weekday: 'Pon' | 'Wt' | 'Śr' | 'Czw' | 'Pt' | 'Sob' | 'Niedz';
  room?: string;
  building?: string;
  color?: string;
  everyOtherWeek?: boolean;
};

export async function addClass(page: Page, newClass: NewClass) {
  await page.getByRole('button', { name: 'Dodaj zajęcia' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dodaj zajęcia' });
  await dialog.getByLabel('Przedmiot').fill(newClass.subject);
  await dialog.getByLabel('Budynek').fill(newClass.building ?? 'Wydział E2E');
  await dialog.getByLabel('Sala', { exact: true }).fill(newClass.room ?? '101');
  if (newClass.color) {
    await dialog.getByLabel('Kolor zajęć').fill(newClass.color);
  }
  // The form preselects Monday.
  if (newClass.weekday !== 'Pon') {
    await dialog.getByLabel('Pon', { exact: true }).uncheck();
    await dialog.getByLabel(newClass.weekday, { exact: true }).check();
  }
  if (newClass.everyOtherWeek) {
    await dialog.getByLabel('Co dwa tygodnie').check();
  }
  await dialog.getByRole('button', { name: 'Dodaj zajęcia' }).click();
  await expect(dialog).toBeHidden();
}

export function dayCell(page: Page, date: string): Locator {
  return page.locator(`.fc-daygrid-day[data-date="${date}"]`);
}

export function eventOn(page: Page, date: string, subject: string): Locator {
  return dayCell(page, date).locator('.fc-event', { hasText: subject });
}

export async function goToNextMonth(page: Page) {
  await page.locator('.fc-next-button').click();
}

export async function openDetails(page: Page, date: string, subject: string) {
  await eventOn(page, date, subject).click();
  const details = page.locator('.event-details');
  await expect(details).toContainText(date);

  return details;
}
