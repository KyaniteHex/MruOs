import {
  expect,
  expectAccountCalendar,
  login,
  logout,
  openAsGuest,
  password,
  register,
  reloadSignedIn,
  test,
} from './helpers';

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

  await logout(page);

  await login(page, email);
  await expectAccountCalendar(page);
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

  await logout(page);
  await login(page, email, password, { remember: false });
  await expectAccountCalendar(page);
  // -1 marks a cookie that ends with the browser session.
  expect((await sessionCookie())?.expires).toBe(-1);
});

test('keeps the session after a page reload', async ({ page }) => {
  await register(page);

  await reloadSignedIn(page);
});

test('rejects a wrong password', async ({ page }) => {
  const email = await register(page);
  await logout(page);

  await login(page, email, 'wrong-password-123');

  await expect(page.getByRole('alert')).toHaveText(
    'Nieprawidłowy adres e-mail lub hasło.',
  );
});

test('rejects registering the same e-mail twice', async ({ page }) => {
  const email = await register(page);
  await logout(page);

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

test('fits the screen width with and without an account', async ({ page }) => {
  // A phone widens the layout to fit the content, so compare the page with
  // the screen rather than with window.innerWidth.
  const screenWidth = page.viewportSize()?.width ?? 0;
  const overflow = async () =>
    (await page.evaluate(() => document.documentElement.scrollWidth)) -
    screenWidth;

  await openAsGuest(page);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await register(page);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole('link', { name: 'Ustawienia' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ustawienia', level: 1 }),
  ).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
