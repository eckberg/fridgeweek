import { computeLayout, resolveConfig, type SheetConfig } from '@fridgeweek/core';
import { describe, expect, it } from 'vitest';
import { renderFilledOverlay, type SampleEntry } from '../src/lib/filledSample.js';

/**
 * The overlay is an illustration, but it is an illustration positioned by the
 * real layout: a ring that misses its mark says the wrong thing about the
 * product. What is worth guarding is that it lands on the marks it was asked
 * for, on nothing else, and in the same place every build.
 */

const config: SheetConfig = resolveConfig({
  locale: 'en-GB',
  people: [
    { name: 'Iris', symbol: 'unicorn', initial: 'I' },
    { name: 'Otto', symbol: 'dinosaur', initial: 'O' },
  ],
  weekStarting: '2026-09-07',
});
const layout = computeLayout(config);

function overlay(entries: SampleEntry[]): string {
  return renderFilledOverlay(layout, entries);
}

function ringCount(svg: string): number {
  return svg.match(/<path /g)?.length ?? 0;
}

describe('the filled sample overlay', () => {
  it('is nothing at all when there is nothing written', () => {
    expect(overlay([])).toBe('');
  });

  it("shares the sheet's paper, and is hidden from assistive technology", () => {
    const svg = overlay([{ day: 0, line: 0, text: 'swimming kit', who: ['Iris'] }]);
    expect(svg).toContain(`viewBox="0 0 ${layout.paper.width} ${layout.paper.height}"`);
    expect(svg).toContain('aria-hidden="true"');
  });

  it('writes the entry on the line it names', () => {
    const line = layout.days[2]?.lines[1];
    const svg = overlay([{ day: 2, line: 1, text: 'library books back', who: [] }]);
    expect(svg).toContain('library books back');
    // Started just inside the writing rule, and sitting on it rather than above.
    const x = Number(/<text x="([-\d.]+)"/.exec(svg)?.[1]);
    const baseline = Number(/<text x="[-\d.]+" y="([-\d.]+)"/.exec(svg)?.[1]);
    expect(x).toBeCloseTo((line?.rule.x1 ?? 0) + 1.5, 3);
    expect(baseline).toBeLessThan(line?.rule.y ?? 0);
    expect(baseline).toBeGreaterThan((line?.rule.y ?? 0) - (line?.height ?? 0) / 2);
    expect(ringCount(svg)).toBe(0);
  });

  it('escapes what is written, because it ends up in markup', () => {
    const svg = overlay([{ day: 0, line: 0, text: 'jam & <bread>', who: [] }]);
    expect(svg).toContain('jam &amp; &lt;bread&gt;');
    expect(svg).not.toContain('<bread>');
  });

  it('rings one mark per person named, and nobody else', () => {
    expect(ringCount(overlay([{ day: 0, line: 0, text: 'x', who: ['Iris'] }]))).toBe(1);
    expect(ringCount(overlay([{ day: 0, line: 0, text: 'x', who: ['Iris', 'Otto'] }]))).toBe(2);
    expect(ringCount(overlay([{ day: 0, line: 0, text: 'x', who: ['Nobody'] }]))).toBe(0);
  });

  it('rings the household on the family mark', () => {
    const svg = overlay([{ day: 0, line: 0, text: 'preschool closed', who: ['family'] }]);
    const family = layout.days[0]?.lines[0]?.marks.find((slot) => slot.mark.kind === 'family');
    expect(family).toBeDefined();
    expect(ringCount(svg)).toBe(1);
    // Centred on the mark: the path starts within a mark's width of its middle.
    const startX = Number(/M([-\d.]+) /.exec(svg)?.[1]);
    const centre = (family?.x ?? 0) + (family?.size ?? 0) / 2;
    expect(Math.abs(startX - centre)).toBeLessThan(family?.size ?? 0);
  });

  it('ignores a day or a line the sheet does not have', () => {
    expect(overlay([{ day: 9, line: 0, text: 'x', who: [] }])).toBe('');
    expect(overlay([{ day: 0, line: 7, text: 'x', who: [] }])).toBe('');
  });

  it('draws the same thing twice, because a build has to be repeatable', () => {
    const entries: SampleEntry[] = [
      { day: 0, line: 0, text: 'swimming kit', who: ['Iris'] },
      { day: 3, line: 0, text: 'football at five', who: ['Iris', 'Otto'] },
    ];
    expect(overlay(entries)).toBe(overlay(entries));
  });

  it("rounds to the sheet's own three decimals", () => {
    const svg = overlay([{ day: 1, line: 2, text: 'dentist', who: ['Otto'] }]);
    const numbers = svg.match(/-?\d+\.\d+/g) ?? [];
    expect(numbers.length).toBeGreaterThan(0);
    for (const number of numbers) {
      expect(number.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });
});
