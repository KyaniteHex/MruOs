import { readFile } from 'node:fs/promises';
import {
  addClass,
  addFromMenu,
  chooseInSettings,
  dayCell,
  eventOn,
  expect,
  isNarrow,
  openAsGuest,
  openDetails,
  openUpcoming,
  register,
  reloadSignedIn,
  showMonth,
  test,
  upcomingSummary,
} from './helpers';

// "Nadchodzące" counts from today, so the browser lives on Monday 2026-10-05.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-05T07:00:00+02:00'));
});

test('adds a kolokwium to a class and lists it as upcoming', async ({
  page,
}) => {
  await openAsGuest(page);
  await showMonth(page);
  if (isNarrow(page)) {
    // Phones show "Nadchodzące" only when something is coming up.
    await expect(upcomingSummary(page)).toHaveCount(0);
  } else {
    await expect(upcomingSummary(page)).toContainText(
      'Nic w najbliższych 14 dniach',
    );
  }

  const details = await openDetails(page, '2026-10-05', 'Matematyka');
  await details.getByRole('button', { name: '+ Kolokwium' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Dodaj kolokwium lub egzamin',
  });
  await expect(dialog.getByLabel('Tytuł')).toHaveValue('Kolokwium');
  await dialog.getByLabel('Zakres lub opis (opcjonalnie)').fill('Całki');
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(eventOn(page, '2026-10-05', 'Matematyka')).toHaveClass(
    /has-test/,
  );
  await expect(details).toContainText('Całki');
  await expect(upcomingSummary(page)).toContainText('dziś');
  await expect(upcomingSummary(page)).toContainText('Kolokwium: Matematyka');
});

test('adds an exam at its own time and edits it', async ({ page }) => {
  await openAsGuest(page);
  await showMonth(page);

  await addFromMenu(page, 'Kolokwium lub egzamin');
  const dialog = page.getByRole('dialog', {
    name: 'Dodaj kolokwium lub egzamin',
  });
  await dialog.getByLabel('Egzamin').check();
  await dialog.getByLabel('Przedmiot', { exact: true }).fill('Fizyka');
  // Fizyka is on Thursdays, so on Wednesday the exam has its own time.
  await dialog.getByLabel('Data', { exact: true }).fill('2026-10-14');
  await dialog.getByLabel('Od', { exact: true }).fill('10:00');
  await dialog.getByLabel('Do', { exact: true }).fill('12:00');
  await dialog.getByLabel('Sala', { exact: true }).fill('Aula');
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(dialog).toBeHidden();

  // The calendar moves to the exam.
  await expect(
    dayCell(page, '2026-10-14').locator('.calendar-assessment', {
      hasText: 'Egzamin: Fizyka',
    }),
  ).toBeVisible();
  await expect(upcomingSummary(page)).toContainText('za 9 dni');

  await (
    await openUpcoming(page)
  )
    .getByRole('button', { name: /Egzamin: Fizyka/ })
    .click();
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible();
  const details = page.locator('.assessment-details');
  await expect(details).toContainText('Aula');
  await expect(details).toContainText('10:00–12:00');

  await details.getByRole('button', { name: 'Edytuj' }).click();
  const edit = page.getByRole('dialog', {
    name: 'Edytuj kolokwium lub egzamin',
  });
  await edit.getByLabel('Sala', { exact: true }).fill('Sala 5');
  await edit.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(edit).toBeHidden();
  await expect(details).toContainText('Sala 5');
});

test('keeps entries in the account and lists those that lost their class', async ({
  page,
}) => {
  await register(page);
  await addClass(page, { subject: 'Algorytmy', weekday: 'Wt' });
  await showMonth(page);

  // A note about the whole subject and a kolokwium on 2026-09-29.
  const details = await openDetails(page, '2026-09-29', 'Algorytmy');
  await details.getByRole('button', { name: '+ Notatka' }).click();
  const noteDialog = page.getByRole('dialog', { name: 'Dodaj notatkę' });
  await noteDialog.getByLabel('Całego przedmiotu').check();
  await noteDialog.getByLabel('Treść').fill('Projekt zaliczeniowy w parach');
  await noteDialog.getByRole('button', { name: 'Zapisz notatkę' }).click();
  await expect(noteDialog).toBeHidden();
  await details.getByRole('button', { name: '+ Kolokwium' }).click();
  await page
    .getByRole('dialog', { name: 'Dodaj kolokwium lub egzamin' })
    .getByRole('button', { name: 'Zapisz', exact: true })
    .click();

  await reloadSignedIn(page);
  await showMonth(page);
  const reloaded = await openDetails(page, '2026-09-29', 'Algorytmy');
  await expect(reloaded).toContainText('Projekt zaliczeniowy w parach');
  await expect(eventOn(page, '2026-09-29', 'Algorytmy')).toHaveClass(
    /has-test/,
  );

  // Cancelling the class leaves the kolokwium without a class.
  await reloaded.getByRole('button', { name: 'Edytuj', exact: true }).click();
  const classDialog = page.getByRole('dialog', { name: 'Edytuj zajęcia' });
  await classDialog.getByRole('button', { name: 'Usuń' }).click();
  await classDialog
    .getByRole('button', { name: 'Potwierdź usunięcie' })
    .click();
  await expect(classDialog).toBeHidden();

  if (isNarrow(page)) {
    await expect(upcomingSummary(page)).toContainText('1 wpis bez terminu');
  }
  const orphan = (await openUpcoming(page)).getByRole('button', {
    name: /Kolokwium · Algorytmy · 2026-09-29/,
  });
  await orphan.click();
  const move = page.getByRole('dialog', {
    name: 'Edytuj kolokwium lub egzamin',
  });
  await move.getByLabel('Data', { exact: true }).fill('2026-10-06');
  await expect(move.getByLabel('W czasie zajęć')).toBeChecked();
  await move.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(move).toBeHidden();

  await expect(orphan).toHaveCount(0);
  await expect(upcomingSummary(page)).toContainText('Kolokwium: Algorytmy');
  await expect(upcomingSummary(page)).toContainText('jutro');
});

test('exports kolokwia with reminders and notes only when chosen', async ({
  page,
}) => {
  await openAsGuest(page);
  await showMonth(page);
  const details = await openDetails(page, '2026-10-05', 'Matematyka');
  await details.getByRole('button', { name: '+ Kolokwium' }).click();
  await page
    .getByRole('dialog', { name: 'Dodaj kolokwium lub egzamin' })
    .getByRole('button', { name: 'Zapisz', exact: true })
    .click();
  await details.getByRole('button', { name: '+ Notatka' }).click();
  const noteDialog = page.getByRole('dialog', { name: 'Dodaj notatkę' });
  await noteDialog.getByLabel('Treść').fill('Przynieść kalkulator');
  await noteDialog.getByRole('button', { name: 'Zapisz notatkę' }).click();
  await expect(noteDialog).toBeHidden();

  await chooseInSettings(page, 'Eksport', 'Format ICS');
  const exportDialog = page.getByRole('dialog', {
    name: 'Eksport do kalendarza',
  });
  await exportDialog.getByLabel('Notatki, w opisach zajęć').uncheck();
  const download = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Pobierz plik .ics' }).click();
  const content = await readFile((await (await download).path()) ?? '', 'utf8');

  // A kolokwium during a class is part of the class's event.
  expect(content).toContain('SUMMARY:⚑ Matematyka · Kolokwium');
  expect(content).toContain('TRIGGER:-P1D');
  expect(content).not.toContain('Przynieść kalkulator');
});
