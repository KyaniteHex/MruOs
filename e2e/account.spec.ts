import { readFile } from 'node:fs/promises';
import {
  chooseInSettings,
  expect,
  expectAccountCalendar,
  login,
  openSettings,
  password,
  register,
  test,
} from './helpers';

const newPassword = 'Ksiazka-Kwiat-Morze-7';

test('changing the password logs other devices out', async ({
  page,
  browser,
}) => {
  const email = await register(page);
  const phoneContext = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const phone = await phoneContext.newPage();
  await login(phone, email);
  await expectAccountCalendar(phone, 15_000);

  await openSettings(page);
  await page.getByLabel('Obecne hasło').fill(password);
  await page.getByLabel('Nowe hasło', { exact: true }).fill(newPassword);
  await page.getByLabel('Powtórz nowe hasło').fill(newPassword);
  await page.getByRole('button', { name: 'Zmień hasło' }).click();
  await expect(
    page.getByText(
      'Hasło zostało zmienione. Pozostałe urządzenia zostały wylogowane.',
    ),
  ).toBeVisible({ timeout: 15_000 });

  // The phone's session is gone; the new password works there.
  await phone.reload();
  await expect(
    phone.getByRole('heading', { name: 'Zaloguj się' }),
  ).toBeVisible();
  await login(phone, email, newPassword);
  await expectAccountCalendar(phone, 15_000);
  await phoneContext.close();
});

test('downloads the data and deletes the account', async ({ page }) => {
  const email = await register(page);

  // A copy of an account's plan also holds the account's details.
  const download = page.waitForEvent('download');
  await chooseInSettings(page, 'Eksport', 'Format JSON');
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file, 'utf8'));
  expect(exported.account.email).toBe(email);
  expect(exported.version).toBe(1);

  await page.getByLabel('Hasło do usunięcia konta').fill(password);
  await page.getByRole('button', { name: 'Usuń konto na zawsze' }).click();
  await page.getByRole('button', { name: 'Tak, usuń konto' }).click();
  await expect(
    page.getByText('Konto i wszystkie jego dane zostały usunięte.'),
  ).toBeVisible({ timeout: 15_000 });

  await login(page, email);
  await expect(page.getByRole('alert')).toHaveText(
    'Nieprawidłowy adres e-mail lub hasło.',
  );
});
