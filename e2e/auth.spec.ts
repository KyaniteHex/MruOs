import { expect, test } from '@playwright/test';
import { login, password, register } from './helpers';

const loginHeading = { name: 'Zaloguj się' };
const day = 24 * 60 * 60 * 1000;

test('starts at the login page and opens the calendar after registering', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', loginHeading)).toBeVisible();

  await register(page);

  await expect(page).toHaveURL(/\/kalendarz$/);
});

test('logs out to the login page and logs back in', async ({ page }) => {
  const email = await register(page);

  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await expect(page.getByRole('heading', loginHeading)).toBeVisible();

  await login(page, email);
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
});

test('remembers the session for 30 days only when asked', async ({
  page,
  context,
}) => {
  const sessionCookie = async () =>
    (await context.cookies()).find((cookie) => cookie.name === 'mruos.sid');
  const email = await register(page);

  const remembered = await sessionCookie();
  expect((remembered?.expires ?? 0) * 1000 - Date.now()).toBeGreaterThan(
    29 * day,
  );

  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await login(page, email, password, { remember: false });
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
  // -1 marks a cookie that ends with the browser session.
  expect((await sessionCookie())?.expires).toBe(-1);
});

test('keeps the session after a page reload', async ({ page }) => {
  await register(page);

  await page.reload();

  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
});

test('rejects a wrong password', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Wyloguj' }).click();

  await login(page, email, 'wrong-password-123');

  await expect(page.getByRole('alert')).toHaveText(
    'Nieprawidłowy adres e-mail lub hasło.',
  );
});

test('rejects registering the same e-mail twice', async ({ page }) => {
  const email = await register(page);
  await page.getByRole('button', { name: 'Wyloguj' }).click();

  await page.goto('/rejestracja');
  await page.getByLabel('E-mail').fill(email);
  await page
    .getByLabel('Hasło (co najmniej 12 znaków)')
    .fill('another-' + password);
  await page.getByLabel('Powtórz hasło').fill('another-' + password);
  await page.getByRole('button', { name: 'Zarejestruj' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Konto z tym adresem już istnieje.',
  );
});

test('sends visitors of protected pages to the login page', async ({
  page,
}) => {
  for (const path of ['/kalendarz', '/konto']) {
    await page.goto(path);
    await expect(page.getByRole('heading', loginHeading)).toBeVisible();
  }
});
