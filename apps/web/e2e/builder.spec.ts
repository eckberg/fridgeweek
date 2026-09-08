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

test('renaming a person updates the legend and the initial it suggests', async ({ page }) => {
  await page.getByLabel('Name of person 1').fill('Ingrid');
  await expect(page.locator('.paper svg')).toContainText('Ingrid');
  await page.getByRole('button', { name: 'Mark for Ingrid' }).click();
  await expect(page.getByLabel('Initials for Ingrid')).toHaveAttribute('placeholder', 'I');
});

test('typing initials in the picker draws that person as letters', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  await page.getByLabel('Initials for Alex').fill('AB');

  const text = await sheetText(page);
  expect(text).toContain('AB');
  // Only Alex changed: Sam keeps his rocket, and the house is still a house,
  // so two of the three marks on every line are still symbols.
  expect(await page.locator('.paper svg use').count()).toBe(7 * 3 * 2 + 2);
});

test('clearing the initials gives that person their symbol back', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  const initials = page.getByLabel('Initials for Alex');
  await initials.fill('AB');
  await expect(page.locator('.paper svg')).toContainText('AB');

  await initials.fill('');
  await expect(page.locator('.paper svg')).not.toContainText('AB');
  expect(await page.locator('.paper svg use').count()).toBe(7 * 3 * 3 + 3);
});

test('a renamed person keeps initials that were typed on purpose', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  await page.getByLabel('Initials for Alex').fill('Zz');
  await page.getByLabel('Name of person 1').fill('Bea');
  await expect(page.getByLabel('Initials for Bea')).toHaveValue('Zz');
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

test('the mark picker refuses a symbol another person already has', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  const picker = page.getByRole('group', { name: 'Choose a mark' });
  await expect(picker).toBeVisible();

  await expect(picker.getByRole('button', { name: 'Rocket' })).toBeDisabled();
  await picker.getByRole('button', { name: 'Dog' }).click();
  await expect(picker).toBeHidden();
  // Counted by symbol rather than read by position: the family mark leads every
  // strip (DESIGN.md decision 7), so Alex's mark is not the first `use`. She is
  // the dog on each writing line and in the legend, and the cat is gone.
  await expect(page.locator('.paper svg use[href$="-dog"]')).toHaveCount(7 * 3 + 1);
  await expect(page.locator('.paper svg use[href$="-cat"]')).toHaveCount(0);
});

test('only one person opens their mark at a time', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  await expect(page.getByRole('group', { name: 'Choose a mark' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Mark for Sam' }).click();
  const open = page.getByRole('group', { name: 'Choose a mark' });
  await expect(open).toHaveCount(1);
  // The panel moved to Sam's row, so Alex's trigger is closed again.
  await expect(page.getByRole('button', { name: 'Mark for Alex' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('the picker filters by search and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  const picker = page.getByRole('group', { name: 'Choose a mark' });
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
  await page.getByRole('button', { name: 'Mark for Alex' }).click();
  await page.getByLabel('Initials for Alex').fill('A');
  await page.getByRole('button', { name: 'Add a person' }).click();

  // Two people drawn as the same letter cannot be told apart, so the engine
  // refuses the second one.
  await page.getByRole('button', { name: 'Mark for Robin' }).click();
  await page.getByLabel('Initials for Robin').fill('A');
  await expect(page.getByRole('status').filter({ hasText: 'same initial' })).toBeVisible();
});

test('the copies field snaps a silly number back into range', async ({ page }) => {
  const copies = page.getByLabel('Copies', { exact: true });
  await copies.fill('500');
  await copies.blur();
  await expect(copies).toHaveValue('25');
});

test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 720 } });

  test('the page scrolls', async ({ page }) => {
    // Wide, the builder fills the viewport and each pane scrolls itself. Stacked,
    // it is one long page, and the page is the only thing left that can scroll.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(overflows).toBe(true);

    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('the whole panel and the sheet are reachable', async ({ page }) => {
    const copies = page.getByLabel('Copies', { exact: true });
    await copies.scrollIntoViewIfNeeded();
    await expect(copies).toBeInViewport();

    const sheet = page.locator('.paper svg');
    await sheet.scrollIntoViewIfNeeded();
    await expect(sheet).toBeInViewport();
  });
});
