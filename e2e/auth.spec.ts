import { expect, test } from '@playwright/test';
import { login, register, uniqueEmail } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('registers, logs out and logs back in', async ({ page }) => {
  const email = await register(page);

  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await expect(
    page.getByRole('button', { name: 'Zaloguj', exact: true }),
  ).toBeVisible();

  await login(page, email);
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
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

  await expect(
    page
      .getByRole('dialog', { name: 'Zaloguj się' })
      .getByRole('alert')
      .filter({ hasText: 'Nieprawidłowy adres e-mail lub hasło.' }),
  ).toBeVisible();
});

test('rejects registering the same e-mail twice', async ({ page }) => {
  const email = await register(page, uniqueEmail());
  await page.getByRole('button', { name: 'Wyloguj' }).click();

  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Zaloguj się' })
    .getByRole('button', { name: 'Utwórz konto' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Utwórz konto' });
  await dialog.getByLabel('E-mail').fill(email);
  await dialog.getByLabel('Hasło').fill('another-long-password');
  await dialog.getByRole('button', { name: 'Zarejestruj' }).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    'Konto z tym adresem już istnieje.',
  );
});
