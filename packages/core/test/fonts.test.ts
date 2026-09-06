import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  FONT_FAMILY,
  FONT_FILES,
  FONT_LICENSE,
  FONT_STACK,
  FONT_SUBSETS,
  FONT_WEIGHT_RANGE,
  fontFaceCss,
} from '../src/fonts/index.js';

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

/** Table tags in the order of the WOFF2 known-table index (spec appendix B). */
const WOFF2_KNOWN_TAGS =
  'cmap head hhea hmtx maxp name OS/2 post cvt_ fpgm glyf loca prep CFF_ VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG_ sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'.split(
    ' ',
  );

/**
 * Reads the `wght` axis out of a WOFF2 variable font: parse the table
 * directory, brotli-decompress the font data, then walk to `fvar`.
 */
function weightAxis(file: string): { min: number; def: number; max: number } {
  const buf = readFileSync(file);
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  let p = 48;
  const readBase128 = (): number => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buf[p++] as number;
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return value >>> 0;
    }
    throw new Error('bad UIntBase128');
  };
  const directory: { tag: string; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++] as number;
    const known = flags & 0x3f;
    let tag: string;
    if (known === 0x3f) {
      tag = buf.toString('latin1', p, p + 4);
      p += 4;
    } else {
      tag = (WOFF2_KNOWN_TAGS[known] ?? '????').replace('_', ' ');
    }
    const transform = (flags >> 6) & 0x03;
    const origLength = readBase128();
    const glyfOrLoca = tag === 'glyf' || tag === 'loca';
    const transformed = glyfOrLoca ? transform === 0 : transform !== 0;
    directory.push({ tag, length: transformed ? readBase128() : origLength });
  }
  const data = brotliDecompressSync(buf.subarray(p, p + totalCompressed));
  let offset = 0;
  for (const table of directory) {
    if (table.tag === 'fvar') break;
    offset += table.length;
  }
  const fvar = data.subarray(offset);
  const axesOffset = fvar.readUInt16BE(4);
  const axisSize = fvar.readUInt16BE(10);
  for (let i = 0; i < fvar.readUInt16BE(8); i++) {
    const base = axesOffset + i * axisSize;
    if (fvar.toString('latin1', base, base + 4) !== 'wght') continue;
    return {
      min: fvar.readInt32BE(base + 4) / 65536,
      def: fvar.readInt32BE(base + 8) / 65536,
      max: fvar.readInt32BE(base + 12) / 65536,
    };
  }
  throw new Error(`no wght axis in ${file}`);
}

describe('FONT_FILES', () => {
  it('holds the two subsets in a deterministic order', () => {
    expect(FONT_FILES.map((f) => f.subset)).toEqual(['latin', 'latin-ext']);
  });

  it('carries base64 that decodes to WOFF2 data', () => {
    for (const file of FONT_FILES) {
      const bytes = Buffer.from(file.base64, 'base64');
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(bytes.length).toBeGreaterThan(1000);
      expect(file.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    }
  });

  it('uses the unicode ranges Google Fonts serves', () => {
    for (const [i, subset] of FONT_SUBSETS.entries()) {
      expect(FONT_FILES[i]?.subset).toBe(subset.subset);
      expect(FONT_FILES[i]?.unicodeRange).toBe(subset.unicodeRange);
      expect(subset.unicodeRange).toMatch(/^U\+[0-9A-F]/);
    }
  });

  it('is in sync with assets/fonts', () => {
    const expected = FONT_SUBSETS.map(({ subset, file, unicodeRange }) => ({
      subset,
      unicodeRange,
      base64: readFileSync(join(fontsDir, file)).toString('base64'),
    }));
    expect(FONT_FILES).toEqual(expected);
  });
});

describe('fontFaceCss', () => {
  const css = fontFaceCss();

  it('emits one @font-face per subset', () => {
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css.match(/unicode-range:/g)).toHaveLength(2);
    for (const subset of FONT_SUBSETS) {
      expect(css).toContain(`unicode-range: ${subset.unicodeRange};`);
    }
  });

  it('inlines the font data with no external references', () => {
    expect(css.match(/src: url\(data:font\/woff2;base64,/g)).toHaveLength(2);
    for (const file of FONT_FILES) expect(css).toContain(file.base64);
    expect(css).not.toMatch(/url\((?!data:)/);
    expect(css).not.toContain('http');
  });

  it('declares the family, the variable weight range and blocking display', () => {
    expect(css).toContain(`font-family: '${FONT_FAMILY}';`);
    expect(css.match(/font-weight: 200 800;/g)).toHaveLength(2);
    expect(css.match(/font-display: block;/g)).toHaveLength(2);
    expect(css).toContain("format('woff2');");
  });

  it('is deterministic', () => {
    expect(fontFaceCss()).toBe(css);
  });
});

describe('font metadata', () => {
  it('names the family first in the stack', () => {
    expect(FONT_STACK.startsWith(`'${FONT_FAMILY}'`)).toBe(true);
    expect(FONT_STACK).toContain('sans-serif');
  });

  it('records the licence', () => {
    expect(FONT_LICENSE.license).toBe('OFL-1.1');
    expect(FONT_LICENSE.name).toBe(FONT_FAMILY);
    expect(FONT_LICENSE.url).toMatch(/^https:\/\//);
    expect(FONT_LICENSE.copyright).toContain('Atkinson Hyperlegible Next Project Authors');
  });

  it('ships the licence text next to the fonts', () => {
    const ofl = readFileSync(join(fontsDir, 'OFL.txt'), 'utf8');
    expect(ofl).toContain(FONT_LICENSE.copyright);
    expect(ofl).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('matches the wght axis of the embedded font', () => {
    expect(FONT_WEIGHT_RANGE).toBe('200 800');
    for (const { file } of FONT_SUBSETS) {
      const axis = weightAxis(join(fontsDir, file));
      expect(`${axis.min} ${axis.max}`).toBe(FONT_WEIGHT_RANGE);
      expect(axis.def).toBe(400);
    }
  });
});
