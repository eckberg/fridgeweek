import { describe, expect, it } from 'vitest';
import { resolveConfig, type SheetConfigInput } from '../src/config.js';
import {
  CAP_H,
  COMFORT_LINE_H,
  computeLayout,
  HEADER_GAP,
  HEADER_H,
  type Layout,
  MIN_LINE_H,
  PAPER,
  RULE_LIFT,
} from '../src/layout.js';

function layoutOf(input: SheetConfigInput = {}): Layout {
  return computeLayout(resolveConfig(input));
}

function peopleOf(n: number) {
  const symbols = ['cat', 'dog', 'rocket', 'star', 'unicorn', 'dinosaur'];
  return Array.from({ length: n }, (_, i) => ({
    name: `Person ${i + 1}`,
    symbol: symbols[i] ?? 'cat',
  }));
}

const errors = (l: Layout) => l.issues.filter((i) => i.severity === 'error').map((i) => i.code);
const warnings = (l: Layout) => l.issues.filter((i) => i.severity === 'warning').map((i) => i.code);

describe('computeLayout: geometry', () => {
  it('fills the page: seven equal days between the header and the bottom margin', () => {
    const l = layoutOf({ locale: 'sv-SE' });
    expect(l.paper).toEqual({ name: 'A4', width: 210, height: 297 });
    expect(l.content).toEqual({ x: 10, y: 10, w: 190, h: 277 });
    expect(l.header?.rect.h).toBe(HEADER_H);
    expect(l.days[0]?.rect.y).toBe(10 + HEADER_H + HEADER_GAP);
    expect(l.days).toHaveLength(7);
    const heights = new Set(l.days.map((d) => d.rect.h));
    expect(heights.size).toBe(1);
    const last = l.days[6];
    expect(last).toBeDefined();
    if (last) expect(last.rect.y + last.rect.h).toBeCloseTo(287, 2);
    expect(l.metrics.dayHeight).toBeCloseTo((277 - (HEADER_H + HEADER_GAP)) / 7, 2);
  });

  it('sets the divider midway between the header and the first weekday name', () => {
    const l = layoutOf({ locale: 'sv-SE' });
    const first = l.days[0];
    expect(first).toBeDefined();
    expect(l.header).toBeDefined();
    if (!first || !l.header) return;

    const nameTop = first.name.baseline - CAP_H * first.name.fontSize;
    expect(l.topRule.y - l.header.inkBottom).toBeCloseTo(nameTop - l.topRule.y, 3);
    // Between the two, not on the day block's own edge.
    expect(l.topRule.y).toBeGreaterThan(l.header.inkBottom);
    expect(l.topRule.y).toBeLessThan(first.rect.y);
  });

  it('keeps the divider still when a date is chosen', () => {
    const dated = layoutOf({ locale: 'sv-SE', weekStarting: '2026-09-07' });
    const blank = layoutOf({ locale: 'sv-SE' });
    expect(dated.topRule.y).toBe(blank.topRule.y);
    expect(dated.header?.inkBottom).toBe(blank.header?.inkBottom);
  });

  it('stays centred when the legend wraps and the header reaches lower', () => {
    const l = layoutOf({ locale: 'fi-FI', people: peopleOf(6) });
    const first = l.days[0];
    expect(first).toBeDefined();
    expect(l.header).toBeDefined();
    if (!first || !l.header) return;

    const nameTop = first.name.baseline - CAP_H * first.name.fontSize;
    expect(l.topRule.y - l.header.inkBottom).toBeCloseTo(nameTop - l.topRule.y, 3);
  });

  it('drops the header when nothing needs it', () => {
    const l = layoutOf({ showWeekNumber: false, showDateRange: false, showLegend: false });
    expect(l.header).toBeUndefined();
    expect(l.topRule.y).toBe(10);
    expect(l.metrics.dayHeight).toBeCloseTo(277 / 7, 2);
  });

  it('is stable and rounded', () => {
    const a = layoutOf({ locale: 'sv-SE', people: peopleOf(4) });
    const b = layoutOf({ locale: 'sv-SE', people: peopleOf(4) });
    expect(a).toEqual(b);
    const json = JSON.stringify(a);
    expect(json).not.toMatch(/\d\.\d{4,}/);
  });

  it('places lines inside the day and marks above the rule', () => {
    const l = layoutOf({ people: peopleOf(3), linesPerDay: 3 });
    for (const day of l.days) {
      expect(day.lines).toHaveLength(3);
      for (const line of day.lines) {
        expect(line.rule.y).toBeGreaterThan(day.rect.y + l.metrics.headHeight);
        expect(line.rule.y).toBeLessThan(day.rect.y + day.rect.h);
        expect(line.marks).toHaveLength(4); // 3 people + family
        for (const slot of line.marks) {
          expect(slot.y + slot.size).toBeLessThan(line.rule.y);
          expect(slot.x + slot.size).toBeLessThan(line.rule.x1);
        }
      }
    }
  });

  it('omits the family mark when disabled', () => {
    const l = layoutOf({ people: peopleOf(2), familyMark: false });
    expect(l.days[0]?.lines[0]?.marks).toHaveLength(2);
  });

  it('uses the locale day order and weekend flags', () => {
    const us = layoutOf({ locale: 'en-US' });
    expect(us.days[0]?.name.text).toBe('SUNDAY');
    expect(us.days[0]?.weekend).toBe(true);
    expect(us.days[1]?.weekend).toBe(false);
    const sv = layoutOf({ locale: 'sv-SE' });
    expect(sv.days[0]?.name.text).toBe('MÅNDAG');
    expect(sv.days[5]?.weekend).toBe(true);
    expect(sv.days[6]?.weekend).toBe(true);
    const forced = layoutOf({ locale: 'en-US', weekStart: 'monday' });
    expect(forced.days[0]?.name.text).toBe('MONDAY');
  });

  it('shows the week number for ISO locales by default and not for the US', () => {
    expect(layoutOf({ locale: 'sv-SE' }).header?.weekLabel).toBeDefined();
    expect(layoutOf({ locale: 'de-DE' }).header?.weekLabel).toBeDefined();
    expect(layoutOf({ locale: 'en-US' }).header?.weekLabel).toBeUndefined();
    expect(layoutOf({ locale: 'en-US', showWeekNumber: true }).header?.weekLabel).toBeDefined();
    expect(layoutOf({ locale: 'sv-SE', showWeekNumber: false }).header?.weekLabel).toBeUndefined();
  });

  it('sets the week number in the label rather than in a box of its own', () => {
    const dated = layoutOf({ locale: 'sv-SE', weekStarting: '2026-09-09' });
    expect(dated.header?.weekLabel?.text).toBe('VECKA 37');
    // Printed, there is nothing left to write on.
    expect(dated.header?.weekNumberField).toBeUndefined();

    const blank = layoutOf({ locale: 'sv-SE' });
    expect(blank.header?.weekLabel?.text).toBe('VECKA');
    expect(blank.header?.weekNumberField).toBeDefined();
    // The rule takes the width the number would have, so choosing a date does
    // not move the rest of the header.
    expect(blank.header?.dateRange?.x).toBe(dated.header?.dateRange?.x);
  });

  it('prints dates when a week start is given', () => {
    const l = layoutOf({ locale: 'sv-SE', weekStarting: '2026-09-09' });
    expect(l.header?.weekLabel?.text).toBe('VECKA 37');
    expect(l.days.map((d) => d.dateField?.text)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
    const blank = layoutOf({ locale: 'sv-SE' });
    expect(blank.header?.weekLabel?.text).toBe('VECKA');
    expect(blank.days[0]?.dateField?.text).toBeUndefined();
  });

  it('keeps the date field inside the page for long weekday names', () => {
    for (const locale of ['de-DE', 'fi-FI', 'pt-PT', 'sv-SE', 'en-GB']) {
      const l = layoutOf({ locale });
      for (const day of l.days) {
        expect(day.dateField).toBeDefined();
        if (day.dateField) {
          expect(day.dateField.x + day.dateField.w).toBeLessThanOrEqual(l.content.x + l.content.w);
        }
      }
    }
  });
});

describe('computeLayout: sheet v2 geometry', () => {
  it('puts the day date in one column at the right edge on every day', () => {
    const l = layoutOf({ locale: 'fi-FI', weekStarting: '2026-09-07' });
    const xs = new Set(l.days.map((d) => d.dateField?.x));
    expect(xs.size).toBe(1);
    const x = l.days[0]?.dateField;
    expect(x).toBeDefined();
    if (x) expect(x.x + x.w).toBeCloseTo(l.content.x + l.content.w, 3);
  });

  it('keeps the widest weekday name clear of the date column', () => {
    for (const locale of ['fi-FI', 'de-DE', 'pt-PT', 'sv-SE']) {
      const l = layoutOf({ locale });
      for (const day of l.days) {
        const dateLeft = day.dateField?.x ?? l.content.x + l.content.w;
        expect(
          day.name.x + day.name.estimatedWidth,
          `${locale} ${day.name.text}`,
        ).toBeLessThanOrEqual(dateLeft);
      }
    }
  });

  it('centres the marks in their line band', () => {
    const l = layoutOf({ people: peopleOf(4), linesPerDay: 3 });
    for (const day of l.days) {
      for (const line of day.lines) {
        for (const slot of line.marks) {
          const above = slot.y - line.top;
          const below = line.top + line.height - (slot.y + slot.size);
          expect(above).toBeCloseTo(below, 2);
        }
      }
    }
  });

  it('leaves a gutter of at least 4.5 mm between the strip and the writing rule', () => {
    for (let n = 1; n <= 6; n++) {
      const l = layoutOf({ people: peopleOf(n) });
      const line = l.days[0]?.lines[0];
      const lastMark = line?.marks.at(-1);
      expect(line).toBeDefined();
      if (line && lastMark) {
        // Every value is rounded to 3 decimals on its own, so a derived
        // difference can land a thousandth either side of the constant.
        expect(line.rule.x1 - (lastMark.x + lastMark.size)).toBeGreaterThan(4.49);
      }
    }
  });

  it('lifts the writing rule so descenders have room', () => {
    const l = layoutOf({ linesPerDay: 2 });
    for (const line of l.days[0]?.lines ?? []) {
      expect(line.top + line.height - line.rule.y).toBeCloseTo(RULE_LIFT, 2);
    }
  });

  it('draws the legend symbol at the same size as a strip mark', () => {
    for (const linesPerDay of [1, 2, 3, 4] as const) {
      const l = layoutOf({ locale: 'sv-SE', linesPerDay, people: peopleOf(3) });
      for (const item of l.header?.legend?.items ?? []) {
        expect(item.symbol.w).toBeCloseTo(l.metrics.markSize, 2);
        expect(item.text.x).toBeCloseTo(item.symbol.x + item.symbol.w + 1.5, 2);
      }
    }
  });

  it('gives the weekday name a band that never starves the writing lines', () => {
    for (const paper of ['A4', 'Letter'] as const) {
      for (const linesPerDay of [1, 2, 3, 4] as const) {
        const l = layoutOf({ paper, linesPerDay });
        expect(l.metrics.headHeight).toBeGreaterThanOrEqual(6);
        expect(l.metrics.headHeight).toBeLessThanOrEqual(9.5);
        expect(l.metrics.lineHeight, `${paper} ${linesPerDay}`).toBeGreaterThanOrEqual(MIN_LINE_H);
      }
    }
  });
});

describe('computeLayout: height budget', () => {
  it.each([
    ['A4', 1],
    ['A4', 2],
    ['A4', 3],
    ['Letter', 1],
    ['Letter', 2],
    ['Letter', 3],
  ] as const)('%s with %i lines is comfortable', (paper, linesPerDay) => {
    const l = layoutOf({ paper, linesPerDay });
    expect(errors(l)).toEqual([]);
    expect(warnings(l)).not.toContain('LINE_TIGHT');
    expect(l.metrics.lineHeight).toBeGreaterThanOrEqual(COMFORT_LINE_H);
  });

  it('four lines fit on A4 and Letter but are tight', () => {
    for (const paper of ['A4', 'Letter'] as const) {
      const l = layoutOf({ paper, linesPerDay: 4 });
      expect(errors(l)).toEqual([]);
      expect(warnings(l)).toContain('LINE_TIGHT');
      expect(l.metrics.lineHeight).toBeGreaterThanOrEqual(MIN_LINE_H);
    }
  });

  it('four lines with a 20 mm margin on Letter do not fit and say why', () => {
    const l = layoutOf({ paper: 'Letter', linesPerDay: 4, marginMm: 20 });
    expect(errors(l)).toContain('LINE_TOO_SHORT');
    const issue = l.issues.find((i) => i.code === 'LINE_TOO_SHORT');
    expect(issue?.remedies.length).toBeGreaterThan(0);
    expect(issue?.remedies[0]).toMatch(/fewer lines/i);
  });

  it('every combination of paper, people and lines 1 to 3 is error free', () => {
    for (const paper of ['A4', 'Letter'] as const) {
      for (let n = 1; n <= 6; n++) {
        for (let lines = 1; lines <= 3; lines++) {
          for (const legend of [true, false]) {
            const l = layoutOf({
              paper,
              people: peopleOf(n),
              linesPerDay: lines,
              showLegend: legend,
            });
            expect(errors(l), `${paper} ${n} people ${lines} lines legend=${legend}`).toEqual([]);
          }
        }
      }
    }
  });

  it('leaves enough writing width with six people and the family mark', () => {
    const l = layoutOf({ people: peopleOf(6) });
    expect(l.metrics.writeWidth).toBeGreaterThan(120);
    expect(errors(l)).toEqual([]);
  });

  it('marks shrink with the line height but stay within bounds', () => {
    const three = layoutOf({ linesPerDay: 3 });
    const four = layoutOf({ linesPerDay: 4 });
    expect(four.metrics.markSize).toBeLessThan(three.metrics.markSize);
    expect(four.metrics.markSize).toBeGreaterThanOrEqual(3.5);
    expect(three.metrics.markSize).toBeLessThanOrEqual(5.5);
  });
});

describe('computeLayout: header', () => {
  it('lays the legend out right-aligned in one row for a small family', () => {
    const l = layoutOf({ locale: 'sv-SE', people: peopleOf(2) });
    const legend = l.header?.legend;
    expect(legend).toBeDefined();
    if (!legend) return;
    expect(legend.rows).toBe(1);
    expect(legend.items).toHaveLength(3);
    const last = legend.items[2];
    if (last)
      expect(last.symbol.x + last.width).toBeLessThanOrEqual(l.content.x + l.content.w + 0.01);
    for (const item of legend.items) {
      expect(item.symbol.x).toBeGreaterThan(l.header?.dateRange?.x ?? 0);
    }
  });

  it('wraps the legend into two rows for a mid-size family', () => {
    const people = [
      { name: 'Alexandra', symbol: 'cat' },
      { name: 'Maximilian', symbol: 'dog' },
      { name: 'Frederik', symbol: 'rocket' },
      { name: 'Josephine', symbol: 'star' },
    ];
    const l = layoutOf({ locale: 'sv-SE', people });
    expect(l.header?.legend?.rows).toBe(2);
    expect(warnings(l)).not.toContain('LEGEND_OVERFLOW');
  });

  it('fits a big family with long names without overflow', () => {
    const people = [
      { name: 'Alexandra', symbol: 'cat' },
      { name: 'Maximilian', symbol: 'dog' },
      { name: 'Frederik', symbol: 'rocket' },
      { name: 'Josephine', symbol: 'star' },
      { name: 'Sebastian', symbol: 'unicorn' },
      { name: 'Charlotte', symbol: 'dinosaur' },
    ];
    const l = layoutOf({ locale: 'sv-SE', people });
    expect(l.header?.legend?.rows).toBeGreaterThanOrEqual(2);
    expect(l.header?.legend?.rows).toBeLessThanOrEqual(3);
    expect(warnings(l)).not.toContain('LEGEND_OVERFLOW');
    const items = l.header?.legend?.items ?? [];
    for (const item of items) {
      expect(item.symbol.y).toBeGreaterThanOrEqual(l.content.y);
      expect(item.text.baseline).toBeLessThanOrEqual(l.content.y + 14);
    }
  });

  it('gives the legend the whole width when the week fields are hidden', () => {
    const l = layoutOf({ showWeekNumber: false, showDateRange: false, people: peopleOf(6) });
    expect(l.header?.weekLabel).toBeUndefined();
    expect(l.header?.dateRange).toBeUndefined();
    expect(l.header?.legend?.maxWidth).toBe(l.content.w);
  });
});

describe('PAPER', () => {
  it('has the standard sizes', () => {
    expect(PAPER.A4).toMatchObject({ width: 210, height: 297 });
    expect(PAPER.Letter).toMatchObject({ width: 215.9, height: 279.4 });
  });
});
