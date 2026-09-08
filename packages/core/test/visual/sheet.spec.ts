/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { renderSheet, resolveConfig, type SheetConfigInput } from '../../src/index.js';

// Invented people. Examples in this repository never use real names.
const family = [
  { name: 'Iris', symbol: 'unicorn' },
  { name: 'Otto', symbol: 'dinosaur' },
  { name: 'Vera', symbol: 'flower' },
  { name: 'Milo', symbol: 'rocket' },
];

/** The same people drawn as letters rather than as pictures. */
function asInitials(people: typeof family): typeof family {
  return people.map((person) => ({ ...person, initial: person.name.slice(0, 1) }));
}

/**
 * A4 at 96 dpi is 794 x 1123 CSS pixels; Letter is 816 x 1056. Screen CSS in
 * the sheet adds a shadow and margin, so the page is emulated as print media
 * and the screenshot is clipped to the first page element.
 */
const cases: Record<string, SheetConfigInput> = {
  'a4-sv-family': { locale: 'sv-SE', people: family },
  'a4-sv-dated': { locale: 'sv-SE', people: family, weekStarting: '2026-09-07' },
  'a4-de-initials': { locale: 'de-DE', people: asInitials(family) },
  // A mark belongs to the person, so both kinds can appear on one sheet.
  'a4-sv-mixed-marks': {
    locale: 'sv-SE',
    people: [...family.slice(0, 2), ...asInitials(family.slice(2))],
  },
  'a4-fi-six-people-four-lines': {
    locale: 'fi-FI',
    linesPerDay: 4,
    people: [...family, { name: 'Aino', symbol: 'cat' }, { name: 'Eero', symbol: 'tractor' }],
  },
  'letter-en-us': { locale: 'en-US', paper: 'Letter', people: family.slice(0, 2) },
  'a4-pt-no-header': {
    locale: 'pt-PT',
    people: family.slice(0, 3),
    showLegend: false,
    showDateRange: false,
    showWeekNumber: false,
  },
};

for (const [name, input] of Object.entries(cases)) {
  test(name, async ({ page }) => {
    const html = renderSheet(resolveConfig(input));
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    const sheet = page.locator('.page').first();
    await expect(sheet).toHaveScreenshot(`${name}.png`);
  });
}
