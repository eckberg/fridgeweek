import { expect, test } from '@playwright/test';

/**
 * The sheet preview is one SVG; its text is the quickest way to read it.
 * `innerText` is not available on SVG nodes, so this reads `textContent`.
 */
async function sheetText(page: import('@playwright/test').Page): Promise<string> {
  return ((await page.locator('.paper svg').textContent()) ?? '').replace(/\s+/g, ' ');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/sheet');
  await expect(page.locator('.paper svg')).toBeVisible();
});

test('renders a sheet with the default household', async ({ page }) => {
  await expect(page.getByRole('form', { name: 'Sheet settings' })).toBeVisible();
  const text = await sheetText(page);
  expect(text).toContain('MONDAY');
  expect(text).toContain('SUNDAY');
  expect(text).toContain('Alex');
});

test('changing the language translates the sheet but not the interface', async ({ page }) => {
  await page.getByLabel('Language').selectOption('sv');

  const text = await sheetText(page);
  expect(text).toContain('MÅNDAG');
  expect(text).toContain('VECKA');
  expect(text).toContain('Alla');

  // The interface is English whatever the sheet is set to.
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a language with no translated words still prints a correct sheet', async ({ page }) => {
  await page.getByLabel('Language').selectOption('pl');
  const text = await sheetText(page);
  // Weekday names come from Intl, so far more languages work than are listed.
  expect(text).toContain('PONIEDZIAŁEK');
  expect(text).toContain('TYDZIEŃ');
});

test('adding a person adds a mark to every line and a legend entry', async ({ page }) => {
  const before = await page.locator('.paper svg use').count();
  await page.getByRole('button', { name: 'Add a person' }).click();

  await expect(page.getByText('3 of 6')).toBeVisible();
  // Seven days of three lines, plus one legend entry.
  expect(await page.locator('.paper svg use').count()).toBe(before + 7 * 3 + 1);
});

test('renaming a person updates the legend and the derived initial', async ({ page }) => {
  await page.getByLabel('Name of person 1').fill('Ingrid');
  await expect(page.locator('.paper svg')).toContainText('Ingrid');
  await expect(page.getByLabel('Initial for Ingrid')).toHaveValue('I');
});

test('switching to initials replaces the symbols with letters', async ({ page }) => {
  await page.getByRole('radio', { name: 'Initial', exact: true }).click();
  const text = await sheetText(page);
  expect(text).toContain('A');
  // The household mark stays a house, so one symbol per line remains.
  expect(await page.locator('.paper svg use').count()).toBe(7 * 3 + 1);
});

test('choosing a week prints the dates and snaps to the first weekday', async ({ page }) => {
  await page.getByLabel('Week starting').fill('2026-09-09');
  await page.getByLabel('Language').selectOption('sv');
  const text = await sheetText(page);
  expect(text).toContain('37');
  // Wednesday the 9th snaps back to Monday the 7th.
  expect(text).toContain('7/9');
});

test('a configuration that cannot fit is reported instead of being shrunk', async ({ page }) => {
  await page.getByRole('radio', { name: '4', exact: true }).click();
  await page.getByRole('radio', { name: 'Letter' }).click();
  await page.getByLabel('Margin').fill('20');

  const status = page.getByRole('status').filter({ hasText: 'Does not fit' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('Use fewer lines per day');
});

test('the configuration lives in the URL and survives a reload', async ({ page }) => {
  await page.getByLabel('Name of person 1').fill('Ingrid');
  await page.getByRole('radio', { name: '2', exact: true }).click();
  await expect(page).toHaveURL(/#.+/);

  const shared = page.url();
  await page.goto(shared);
  await expect(page.locator('.paper svg')).toContainText('Ingrid');
  await expect(page.getByRole('radio', { name: '2', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('a broken link falls back to the defaults rather than an empty page', async ({ page }) => {
  await page.goto('/sheet#this-is-not-a-configuration');
  await expect(page.locator('.paper svg')).toBeVisible();
  await expect(page.locator('.paper svg')).toContainText('Alex');
});

test('the symbol picker refuses a symbol another person already has', async ({ page }) => {
  await page.getByRole('button', { name: 'Symbol for Alex' }).click();
  const picker = page.getByRole('group', { name: 'Choose a symbol' });
  await expect(picker).toBeVisible();

  await expect(picker.getByRole('button', { name: 'Rocket' })).toBeDisabled();
  await picker.getByRole('button', { name: 'Dog' }).click();
  await expect(picker).toBeHidden();
  await expect(page.locator('.paper svg use').first()).toHaveAttribute('href', /-dog$/);
});

test('only one person opens their symbols at a time', async ({ page }) => {
  await page.getByRole('button', { name: 'Symbol for Alex' }).click();
  await expect(page.getByRole('group', { name: 'Choose a symbol' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Symbol for Sam' }).click();
  const open = page.getByRole('group', { name: 'Choose a symbol' });
  await expect(open).toHaveCount(1);
  // The grid moved to Sam's row, so Alex's trigger is closed again.
  await expect(page.getByRole('button', { name: 'Symbol for Alex' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('the picker filters by search and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Symbol for Alex' }).click();
  const picker = page.getByRole('group', { name: 'Choose a symbol' });
  await picker.getByRole('searchbox').fill('unicorn');
  await expect(picker.getByRole('button', { name: 'Unicorn' })).toBeVisible();
  await expect(picker.locator('.option')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
});

test('the print and download actions sit in the page header', async ({ page }) => {
  const header = page.locator('header.site-header');
  await expect(header.getByRole('button', { name: 'Print' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Download PDF' })).toBeVisible();
});

test('a change the engine refuses is explained rather than silently dropped', async ({ page }) => {
  await page.getByRole('radio', { name: 'Initial', exact: true }).click();
  await page.getByRole('button', { name: 'Add a person' }).click();

  // Two people whose names start with the same letter cannot both be told
  // apart by an initial, so the engine refuses the second one.
  await page.getByLabel('Name of person 3').fill('Alfred');
  await expect(page.getByRole('status').filter({ hasText: 'same initial' })).toBeVisible();
});

test('the copies field snaps a silly number back into range', async ({ page }) => {
  const copies = page.getByLabel('Copies', { exact: true });
  await copies.fill('500');
  await copies.blur();
  await expect(copies).toHaveValue('25');
});
