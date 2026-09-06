import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated checks catch a useful minority of accessibility problems: contrast,
 * names, roles, landmarks, heading order. They are not a substitute for using
 * the thing with a keyboard, which the tests below also do.
 */

const pages = [
  { name: 'landing', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'builder', path: '/sheet' },
];

for (const { name, path } of pages) {
  test(`${name} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    if (path === '/sheet') await expect(page.locator('.paper svg')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Name the offending selectors, or a failure says nothing useful.
    const summary = results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    );
    expect(summary).toEqual([]);
  });
}

test('the builder is usable from the keyboard alone', async ({ page }) => {
  await page.goto('/sheet');
  await expect(page.locator('.paper svg')).toBeVisible();

  // Tab from the top of the document until the first person's name field has
  // focus. If it cannot be reached, the panel is not keyboard operable.
  const name = page.getByLabel('Name of person 1');
  for (let i = 0; i < 25 && !(await name.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(name).toBeFocused();

  await page.keyboard.press('Control+a');
  await page.keyboard.type('Ingrid');
  await expect(page.locator('.paper svg')).toContainText('Ingrid');
});

test('every control in the panel has an accessible name', async ({ page }) => {
  await page.goto('/sheet');
  await expect(page.locator('.paper svg')).toBeVisible();

  const unnamed = await page.locator('form.panel').evaluate((form) => {
    const controls = form.querySelectorAll(
      'button, input, select, [role="switch"], [role="radio"]',
    );
    return [...controls]
      .filter((el) => {
        const label = el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '';
        const labelled = el.id ? form.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
        return !label.trim() && !labelled && !(el.textContent ?? '').trim();
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(no class)'}`);
  });

  expect(unnamed).toEqual([]);
});
