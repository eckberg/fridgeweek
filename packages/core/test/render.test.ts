import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.js';
import { renderSheet, renderSheetFromInput, renderSvg } from '../src/render.js';

const family = [
  { name: 'Ava', symbol: 'unicorn' },
  { name: 'Harry', symbol: 'dinosaur' },
  { name: 'Sara', symbol: 'flower' },
  { name: 'Karl', symbol: 'rocket' },
];

describe('renderSvg', () => {
  it('produces a millimetre-scaled SVG with seven days', () => {
    const svg = renderSvg(resolveConfig({ locale: 'sv-SE', people: family }));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 210 297"');
    expect(svg).toContain('width="210mm"');
    expect(svg.match(/<g class="day"/g)).toHaveLength(7);
    expect(svg).toContain('>MÅNDAG<');
    expect(svg).toContain('>SÖNDAG<');
    expect(svg).toContain('>VECKA<');
    expect(svg).toContain('>Alla<');
    expect(svg).toContain('>Ava<');
  });

  it('references one symbol definition per distinct symbol and uses them per line', () => {
    const svg = renderSvg(resolveConfig({ people: family, linesPerDay: 2 }));
    for (const id of ['unicorn', 'dinosaur', 'flower', 'rocket', 'house']) {
      expect(svg.match(new RegExp(`<symbol id="fw-s-${id}"`, 'g'))).toHaveLength(1);
    }
    // 7 days x 2 lines x 5 marks in the strips, plus 5 in the legend.
    expect(svg.match(/<use href="#fw-s-/g)).toHaveLength(7 * 2 * 5 + 5);
  });

  it('draws initials as text when markStyle is initial, and still uses a house for the family', () => {
    const svg = renderSvg(
      resolveConfig({ people: [{ name: 'Åsa', symbol: 'cat' }], markStyle: 'initial' }),
    );
    expect(svg.match(/>Å<\/text>/g)?.length).toBe(7 * 3 + 1);
    expect(svg).not.toContain('fw-s-cat"');
    expect(svg).toContain('<symbol id="fw-s-house"');
  });

  it('outlines weekend names by default and not when plain', () => {
    const outline = renderSvg(resolveConfig({ locale: 'en-GB' }));
    expect(outline).toMatch(/<text [^>]*fill="none" stroke="#111111"[^>]*>SATURDAY</);
    expect(outline).not.toMatch(/<text [^>]*fill="none"[^>]*>MONDAY</);
    const plain = renderSvg(resolveConfig({ locale: 'en-GB', weekendStyle: 'plain' }));
    expect(plain).not.toMatch(/<text [^>]*fill="none"/);
  });

  it('prints dates when a week is chosen', () => {
    const svg = renderSvg(resolveConfig({ locale: 'sv-SE', weekStarting: '2026-09-07' }));
    expect(svg).toContain('>37<');
    expect(svg).toContain('>7/9<');
    expect(svg).toContain('>13/9<');
    const us = renderSvg(
      resolveConfig({ locale: 'en-US', weekStarting: '2026-09-07', showWeekNumber: true }),
    );
    expect(us).toContain('>9/6<');
  });

  it('escapes names', () => {
    const svg = renderSvg(resolveConfig({ people: [{ name: 'A<b>&"c"', symbol: 'cat' }] }));
    expect(svg).toContain('A&lt;b&gt;&amp;&quot;c&quot;');
    expect(svg).not.toContain('<b>');
  });

  it('can embed fonts', () => {
    const plain = renderSvg(resolveConfig({}));
    const embedded = renderSvg(resolveConfig({}), { embedFonts: true });
    expect(plain).not.toContain('@font-face');
    expect(embedded).toContain('@font-face');
    expect(embedded).toContain('data:font/woff2;base64,');
  });

  it('is deterministic', () => {
    const config = resolveConfig({ locale: 'de-DE', people: family, weekStarting: '2026-01-01' });
    expect(renderSvg(config)).toBe(renderSvg(config));
  });
});

describe('renderSheet', () => {
  it('wraps the pages in a self-contained HTML document', () => {
    const html = renderSheet(resolveConfig({ locale: 'sv-SE', people: family, copies: 3 }));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="sv-SE">');
    expect(html).toContain('@page { size: 210mm 297mm; margin: 0; }');
    expect(html).toContain('@font-face');
    expect(html.match(/<div class="page">/g)).toHaveLength(3);
    expect(html.match(/<symbol id="p1-s-house"/g)).toHaveLength(1);
    expect(html.match(/<symbol id="p3-s-house"/g)).toHaveLength(1);
    expect(html).not.toMatch(/src="http/);
    expect(html).not.toMatch(/href="http/);
  });

  it('uses the Letter page size', () => {
    const html = renderSheet(resolveConfig({ paper: 'Letter' }));
    expect(html).toContain('@page { size: 215.9mm 279.4mm; margin: 0; }');
    expect(html).toContain('viewBox="0 0 215.9 279.4"');
  });

  it('renders from loose input', () => {
    expect(renderSheetFromInput({ locale: 'en' })).toContain('>MONDAY<');
    expect(() => renderSheetFromInput({ paper: 'A5' })).toThrow();
  });
});

describe('snapshots', () => {
  it.each([
    ['a4-sv-four-people', { locale: 'sv-SE', people: family }],
    [
      'letter-en-us-two-people-dated',
      { locale: 'en-US', paper: 'Letter', people: family.slice(0, 2), weekStarting: '2026-09-06' },
    ],
    [
      'a4-de-initials-no-header',
      {
        locale: 'de-DE',
        markStyle: 'initial',
        showLegend: false,
        showDateRange: false,
        showWeekNumber: false,
        people: family.slice(0, 3),
      },
    ],
  ] as const)('%s', (_name, input) => {
    expect(renderSvg(resolveConfig(input))).toMatchSnapshot();
  });
});
