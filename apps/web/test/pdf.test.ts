import { renderSheet, resolveConfig } from '@fridgeweek/core';
import { describe, expect, it } from 'vitest';
import { createLocalRenderer } from '../src/lib/pdf/local.js';

/**
 * The largest technical risk in this project is that the PDF is not the same
 * document as the preview, because the renderer had a different typeface.
 * These tests are the guard: they render a real PDF and read the font names
 * back out of it.
 *
 * They need the Chromium that Playwright installs, so they are skipped when it
 * is absent rather than failing a contributor's first test run.
 */

const hasChromium = await canLaunch();

async function canLaunch(): Promise<boolean> {
  try {
    const renderer = await createLocalRenderer();
    await renderer.dispose?.();
    return true;
  } catch {
    return false;
  }
}

function embeddedFontNames(pdf: Uint8Array): string[] {
  const text = Buffer.from(pdf).toString('latin1');
  // Subset fonts are named "ABCDEF+Family"; the prefix is arbitrary.
  return [...text.matchAll(/\/FontName\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/g)].map(
    (match) => match[1] ?? '',
  );
}

describe.skipIf(!hasChromium)('local PDF renderer', () => {
  it('embeds the sheet typeface rather than falling back to a system font', async () => {
    const renderer = await createLocalRenderer();
    try {
      const config = resolveConfig({ locale: 'sv-SE', weekStarting: '2026-09-07' });
      const pdf = await renderer.render(renderSheet(config), { widthMm: 210, heightMm: 297 });

      const names = embeddedFontNames(pdf);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(name).toMatch(/^AtkinsonHyperlegibleNext/);
      }
    } finally {
      await renderer.dispose?.();
    }
  }, 60_000);

  it('renders one page per copy at the configured paper size', async () => {
    const renderer = await createLocalRenderer();
    try {
      const config = resolveConfig({ paper: 'Letter', copies: 3 });
      const pdf = await renderer.render(renderSheet(config), { widthMm: 215.9, heightMm: 279.4 });

      const text = Buffer.from(pdf).toString('latin1');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect([...text.matchAll(/\/Type\s*\/Page[^s]/g)]).toHaveLength(3);

      // Letter is 215.9 x 279.4 mm, which is 612 x 792 PostScript points.
      const mediaBox = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
      expect(mediaBox).not.toBeNull();
      expect(Number(mediaBox?.[1])).toBeCloseTo(612, 0);
      expect(Number(mediaBox?.[2])).toBeCloseTo(792, 0);
    } finally {
      await renderer.dispose?.();
    }
  }, 60_000);
});
