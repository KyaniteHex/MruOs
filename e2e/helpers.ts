import { test as base, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export { expect };

/**
 * Every test lives on Wednesday 30 September 2026, in the first week of the
 * demo semester, since the calendar opens on today. Tests may move the
 * clock with page.clock.setFixedTime.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.clock.setFixedTime(new Date('2026-09-30T08:00:00+02:00'));
    await provide(page);
  },
});

export const password = 'correct-horse-battery';

/** Phones and tablets held upright get details and lists in a sheet. */
export function isNarrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) <= 900;
}

/** Phones show the week from Monday to Friday unless it has weekend classes. */
export function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) <= 600;
}

/** The title of a week: the whole week, or Monday–Friday on phones. */
export function weekTitle(page: Page, wholeWeek: string, workingWeek: string) {
  return isPhone(page) ? workingWeek : wholeWeek;
}

/** Closes the sheet over the calendar, if one is open. */
export async function closeSheet(page: Page) {
  const sheet = page.locator('.sheet');
  if (await sheet.isVisible()) {
    await sheet.getByRole('button', { name: 'Zamknij' }).click();
    await expect(sheet).toBeHidden();
  }
}

/** "Nadchodzące" at a glance: the side panel, or the bar on phones. */
export function upcomingSummary(page: Page): Locator {
  return page.locator(isNarrow(page) ? '.upcoming-bar' : '.upcoming-panel');
}

/** The full "Nadchodzące" list; phones open it from the bar. */
export async function openUpcoming(page: Page): Promise<Locator> {
  if (!isNarrow(page)) {
    return page.locator('.upcoming-panel');
  }
  await closeSheet(page);
  await page.locator('.upcoming-bar').click();
  const sheet = page.getByRole('dialog', { name: 'Nadchodzące' });
  await expect(sheet).toBeVisible();

  return sheet;
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.com`;
}

export async function register(
  page: Page,
  email = uniqueEmail(),
  options: { remember?: boolean } = {},
) {
  await page.goto('/rejestracja');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło (co najmniej 12 znaków)').fill(password);
  await page.getByLabel('Powtórz hasło').fill(password);
  if (options.remember === false) {
    await page.getByLabel('Nie wylogowuj mnie (30 dni)').uncheck();
  }
  await page.getByRole('button', { name: 'Zarejestruj' }).click();
  // Password hashing makes registration slower than other requests.
  await expectAccountCalendar(page, 15_000);

  return email;
}

/** The calendar of a signed-in student, with the account's plan loaded. */
export async function expectAccountCalendar(page: Page, timeout?: number) {
  await expect(page.getByRole('button', { name: '+ Dodaj' })).toBeVisible({
    timeout,
  });
  await expect(page.getByRole('link', { name: 'Zaloguj się' })).toHaveCount(0);
}

/** Fills the login page; the caller checks the outcome. */
export async function login(
  page: Page,
  email: string,
  secret = password,
  options: { remember?: boolean } = {},
) {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(secret);
  if (options.remember === false) {
    await page.getByLabel('Nie wylogowuj mnie (30 dni)').uncheck();
  }
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
}

/** Opens the calendar without an account ("Wypróbuj bez konta"). */
export async function openAsGuest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /bez konta/ }).click();
  await expect(page.getByRole('link', { name: 'Zaloguj się' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Dodaj' })).toBeVisible();
}

/** Picks an item of the "+ Dodaj" menu. */
export async function addFromMenu(
  page: Page,
  item: 'Zajęcia' | 'Kolokwium lub egzamin',
) {
  await closeSheet(page);
  await page.getByRole('button', { name: '+ Dodaj' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

export async function showMonth(page: Page) {
  await closeSheet(page);
  await page.getByRole('button', { name: 'Miesiąc', exact: true }).click();
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible();
}

export async function openSettings(page: Page) {
  await closeSheet(page);
  await page.getByRole('link', { name: 'Ustawienia' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ustawienia', level: 1 }),
  ).toBeVisible();
}

/** Logs out in the settings and waits for the login page. */
export async function logout(page: Page) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Zaloguj się' }),
  ).toBeVisible();
}

/** Picks an item of a menu button in the settings, e.g. "Import". */
export async function chooseInSettings(
  page: Page,
  menu: 'Import' | 'Eksport',
  item: string,
) {
  await openSettings(page);
  await page.getByRole('button', { name: menu, exact: true }).click();
  await page.getByRole('menuitem', { name: item }).click();
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
  await addFromMenu(page, 'Zajęcia');
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

/** The next month, week or day, depending on the view. */
export async function goToNextMonth(page: Page) {
  await closeSheet(page);
  await page.getByRole('button', { name: 'Następny' }).click();
}

/** Opens a class's details: in the side panel, or in a sheet on phones. */
export async function openDetails(page: Page, date: string, subject: string) {
  await closeSheet(page);
  await eventOn(page, date, subject).click();
  const details = page.locator('.event-details');
  await expect(details).toContainText(date);

  return details;
}

/** Reloads and waits for the session to be restored from the API. */
export async function reloadSignedIn(page: Page) {
  await page.reload();
  await expectAccountCalendar(page, 15_000);
}

/** Fills the winter semester of the 2026/2027 calendar of UMK in Toruń. */
export async function fillUmkWinterSemester(dialog: Locator) {
  const winter = dialog.getByRole('group', { name: 'Semestr zimowy' });
  const fill = async (label: string, value: string, index = 0) =>
    winter.getByLabel(label, { exact: true }).nth(index).fill(value);

  await fill('Semestr zimowy: od', '2026-10-01');
  await fill('Semestr zimowy: do', '2027-02-21');
  await fill('Od: Inauguracja roku akademickiego', '2026-10-01');
  await fill('Od: Zajęcia dydaktyczne', '2026-10-02');
  await fill('Do: Zajęcia dydaktyczne', '2026-12-20');
  await fill('Od: Wakacje zimowe', '2026-12-21');
  await fill('Do: Wakacje zimowe', '2027-01-06');
  await fill('Od: Zajęcia dydaktyczne', '2027-01-07', 1);
  await fill('Do: Zajęcia dydaktyczne', '2027-02-04', 1);
  await fill('Od: Egzaminacyjna sesja zimowa', '2027-02-05');
  await fill('Do: Egzaminacyjna sesja zimowa', '2027-02-18');
  await fill('Od: Egzaminacyjna sesja zimowa poprawkowa', '2027-02-20');
  await fill('Do: Egzaminacyjna sesja zimowa poprawkowa', '2027-02-28');
  await fill('Od: Święto uczelni', '2027-02-19');
}
