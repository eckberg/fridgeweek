/**
 * The embedded typeface.
 *
 * Atkinson Hyperlegible Next is designed for maximum letter distinction, which
 * is what a sheet read by children learning letters needs. It is embedded as
 * `data:` URIs so that preview, browser print and server-rendered PDF all use
 * exactly the same glyphs with no network fetch.
 */
import { FONT_FILES } from './fonts.generated.js';
import { FONT_SUBSETS, type FontSubset } from './subsets.js';

export const FONT_FAMILY = 'Atkinson Hyperlegible Next';

/** Fallbacks are wide, plain sans faces that keep the layout close if embedding fails. */
export const FONT_STACK =
  "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', Verdana, 'DejaVu Sans', sans-serif";

/** The `wght` axis of the variable font, read from its `fvar` table (min 200, max 800). */
export const FONT_WEIGHT_RANGE = '200 800';

export interface FontFile {
  subset: FontSubset;
  unicodeRange: string;
  base64: string;
}

/**
 * One `@font-face` rule per subset, with the font data inlined. Deterministic:
 * same input, same bytes, so snapshots of a rendered sheet are stable.
 */
export function fontFaceCss(): string {
  return FONT_FILES.map(
    (file) =>
      `@font-face {\n` +
      `  font-family: '${FONT_FAMILY}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${FONT_WEIGHT_RANGE};\n` +
      `  font-display: block;\n` +
      `  src: url(data:font/woff2;base64,${file.base64}) format('woff2');\n` +
      `  unicode-range: ${file.unicodeRange};\n` +
      `}`,
  ).join('\n');
}

export const FONT_LICENSE: {
  name: string;
  license: 'OFL-1.1';
  url: string;
  copyright: string;
} = {
  name: 'Atkinson Hyperlegible Next',
  license: 'OFL-1.1',
  url: 'https://github.com/googlefonts/atkinson-hyperlegible-next',
  copyright:
    'Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next)',
};

export type { FontSubset };
export { FONT_FILES, FONT_SUBSETS };
