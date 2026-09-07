import { describe, expect, it } from 'vitest';
import { readLucideBodies } from '../scripts/lib/extract-lucide.js';
import { LUCIDE_IDS } from '../src/symbols/curated.js';
import { CUSTOM_IDS, CUSTOM_SYMBOLS } from '../src/symbols/custom.js';
import {
  FAMILY_SYMBOL,
  getSymbol,
  isSymbolId,
  SYMBOL_IDS,
  SYMBOL_LABELS,
  SYMBOL_LICENSES,
  type SymbolId,
  symbolLabel,
  symbolToSvgSymbol,
} from '../src/symbols/index.js';
import { LUCIDE_SYMBOLS, LUCIDE_VERSION } from '../src/symbols/lucide.generated.js';

const ALLOWED_ELEMENTS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'];

/** Every element name that appears in a symbol body. */
function elementNames(body: string): string[] {
  return [...body.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1] ?? '');
}

/** Every `d` attribute value in a symbol body. */
function pathData(body: string): string[] {
  return [...body.matchAll(/\bd="([^"]*)"/g)].map((m) => m[1] ?? '');
}

const ARG_COUNT: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  z: 0,
};

/**
 * Evaluates path data into the absolute points it touches, control points
 * included, so relative commands are checked against the 24x24 grid too.
 * Arcs are not used by our own icons and are rejected.
 */
function absolutePoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const [, letter = '', rest = ''] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const lower = letter.toLowerCase();
    const relative = letter === lower;
    const arity = ARG_COUNT[lower];
    if (arity === undefined) throw new Error(`unsupported path command '${letter}'`);
    const args = (rest.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (arity === 0) {
      if (args.length > 0) throw new Error(`'${letter}' takes no arguments`);
      cx = sx;
      cy = sy;
      continue;
    }
    if (args.length === 0 || args.length % arity !== 0) {
      throw new Error(`'${letter}' got ${args.length} arguments, expected a multiple of ${arity}`);
    }
    for (let i = 0; i < args.length; i += arity) {
      const chunk = args.slice(i, i + arity) as number[];
      if (lower === 'h' || lower === 'v') {
        const value = chunk[0] as number;
        if (lower === 'h') cx = relative ? cx + value : value;
        else cy = relative ? cy + value : value;
        points.push([cx, cy]);
        continue;
      }
      const baseX = relative ? cx : 0;
      const baseY = relative ? cy : 0;
      for (let p = 0; p < chunk.length; p += 2) {
        points.push([baseX + (chunk[p] as number), baseY + (chunk[p + 1] as number)]);
      }
      cx = baseX + (chunk[chunk.length - 2] as number);
      cy = baseY + (chunk[chunk.length - 1] as number);
      if (lower === 'm' && i === 0) {
        sx = cx;
        sy = cy;
      }
    }
  }
  return points;
}

describe('symbol set', () => {
  it('is unique, sorted and complete', () => {
    expect(SYMBOL_IDS.length).toBe(LUCIDE_IDS.length + CUSTOM_IDS.length);
    expect(new Set(SYMBOL_IDS).size).toBe(SYMBOL_IDS.length);
    expect([...SYMBOL_IDS]).toEqual([...SYMBOL_IDS].sort());
    expect(SYMBOL_IDS).toContain('house');
    expect(FAMILY_SYMBOL).toBe('house');
    expect(SYMBOL_IDS).toContain(FAMILY_SYMBOL);
  });

  it('resolves every id to a clean 24x24 body', () => {
    for (const id of SYMBOL_IDS) {
      const symbol = getSymbol(id);
      expect(symbol.id).toBe(id);
      expect(symbol.body.length).toBeGreaterThan(0);
      expect(symbol.body).not.toContain('<svg');
      expect(symbol.body).not.toMatch(/\bfill=/);
      expect(symbol.body).not.toMatch(/\bstroke=/);
      expect(symbol.body).not.toMatch(/[\n\r\t]/);
      const names = elementNames(symbol.body);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(ALLOWED_ELEMENTS).toContain(name);
    }
  });

  it('marks the right source for each id', () => {
    for (const id of LUCIDE_IDS) expect(getSymbol(id).source).toBe('lucide');
    for (const id of CUSTOM_IDS) expect(getSymbol(id).source).toBe('fridgeweek');
    expect(SYMBOL_LICENSES.map((l) => l.source).sort()).toEqual(['fridgeweek', 'lucide']);
    for (const license of SYMBOL_LICENSES) {
      expect(license.license.length).toBeGreaterThan(0);
      expect(license.url).toMatch(/^https:\/\//);
      expect(license.copyright.length).toBeGreaterThan(0);
    }
    expect(SYMBOL_LICENSES.find((l) => l.source === 'lucide')?.license).toContain(LUCIDE_VERSION);
  });

  it('recognises its own ids and nothing else', () => {
    for (const id of SYMBOL_IDS) expect(isSymbolId(id)).toBe(true);
    for (const x of ['nope', '', 'HOUSE', 'flowerbed', 42, null, undefined, {}, ['cat']]) {
      expect(isSymbolId(x)).toBe(false);
    }
  });

  it('wraps a symbol for use in an SVG document', () => {
    const svg = symbolToSvgSymbol('house', 'fw-house');
    expect(svg).toBe(
      `<symbol id="fw-house" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getSymbol('house').body}</symbol>`,
    );
    expect(svg.startsWith('<symbol')).toBe(true);
    expect(svg.endsWith('</symbol>')).toBe(true);
  });

  it('names every symbol', () => {
    for (const id of SYMBOL_IDS) {
      expect(getSymbol(id).label, id).toBe(SYMBOL_LABELS[id]);
      expect(symbolLabel(id).trim().length, id).toBeGreaterThan(0);
    }
    expect(Object.keys(SYMBOL_LABELS).sort()).toEqual([...SYMBOL_IDS]);
  });

  it('names symbols in English, because they are never printed on the sheet', () => {
    expect(symbolLabel('house')).toBe('House');
    expect(symbolLabel('unicorn')).toBe('Unicorn');
  });
});

describe('custom icons', () => {
  it('draw with valid path data inside the 24x24 grid', () => {
    for (const id of CUSTOM_IDS) {
      const body = CUSTOM_SYMBOLS[id];
      const datas = pathData(body);
      expect(datas.length).toBeGreaterThan(0);
      expect(datas.length).toBe(elementNames(body).length);
      for (const d of datas) {
        expect(d).toMatch(/^[MmZzLlHhVvCcSsQqTtAa0-9eE.,\s-]+$/);
        for (const [x, y] of absolutePoints(d)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(24);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it('keep at least one unit of padding', () => {
    for (const id of CUSTOM_IDS) {
      const points = pathData(CUSTOM_SYMBOLS[id]).flatMap(absolutePoints);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...xs)).toBeLessThanOrEqual(23);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...ys)).toBeLessThanOrEqual(23);
    }
  });

  it('are not shadowed by lucide ids', () => {
    for (const id of CUSTOM_IDS) expect(LUCIDE_IDS as readonly string[]).not.toContain(id);
  });
});

describe('lucide.generated.ts', () => {
  it('matches the icons in lucide-static', () => {
    expect(LUCIDE_SYMBOLS).toEqual(readLucideBodies(LUCIDE_IDS));
  });

  it('records the installed lucide-static version', () => {
    expect(LUCIDE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is sorted and holds exactly the curated ids', () => {
    const keys = Object.keys(LUCIDE_SYMBOLS);
    expect(keys).toEqual([...LUCIDE_IDS].sort());
    expect(keys).toEqual([...keys].sort());
  });
});

describe('absolutePoints', () => {
  it('follows relative commands', () => {
    expect(absolutePoints('M2 4l2 2')).toEqual([
      [2, 4],
      [4, 6],
    ]);
    expect(absolutePoints('M2 4h.01')).toEqual([
      [2, 4],
      [2.01, 4],
    ]);
    expect(absolutePoints('M2 4C3 4 4 5 5 6z')).toEqual([
      [2, 4],
      [3, 4],
      [4, 5],
      [5, 6],
    ]);
  });

  it('rejects unknown commands', () => {
    expect(() => absolutePoints('M2 4X1 1')).toThrow();
  });
});

describe('the printed symbol id union', () => {
  it('accepts a literal id at compile time', () => {
    const id: SymbolId = 'unicorn';
    expect(getSymbol(id).source).toBe('fridgeweek');
  });
});
