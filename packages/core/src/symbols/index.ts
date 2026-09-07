/**
 * The symbol set: curated Lucide icons plus a few drawn for Fridgeweek.
 *
 * A symbol body is the inner markup of a 24x24 icon with no `<svg>` wrapper and
 * no presentation attributes; stroke and fill come from the `<symbol>` wrapper
 * built by `symbolToSvgSymbol`, so the renderer can define each mark once and
 * `<use>` it on every line.
 */
import { LUCIDE_IDS } from './curated.js';
import { CUSTOM_IDS, CUSTOM_SYMBOLS } from './custom.js';
import { SYMBOL_LABELS, symbolLabel } from './labels.js';
import { LUCIDE_SYMBOLS, LUCIDE_VERSION } from './lucide.generated.js';

export type SymbolSource = 'lucide' | 'fridgeweek';

export interface SymbolDef {
  id: SymbolId;
  /** Inner SVG markup on a 24x24 grid: no `<svg>` wrapper, no fill/stroke attributes. */
  body: string;
  source: SymbolSource;
  /** The symbol's name, shown on screen and never printed on the sheet. */
  label: string;
}

const ALL_IDS = [...LUCIDE_IDS, ...CUSTOM_IDS] as const;

export type SymbolId = (typeof ALL_IDS)[number];

/** Every symbol id, sorted alphabetically. */
export const SYMBOL_IDS: readonly SymbolId[] = [...ALL_IDS].sort();

/** The mark for the household itself, printed last in every marker strip. */
export const FAMILY_SYMBOL: SymbolId = 'house';

const CUSTOM_ID_SET: ReadonlySet<string> = new Set<string>(CUSTOM_IDS);
const SYMBOL_ID_SET: ReadonlySet<string> = new Set<string>(ALL_IDS);

function bodyOf(id: SymbolId): string {
  if (isCustomId(id)) return CUSTOM_SYMBOLS[id];
  const body = LUCIDE_SYMBOLS[id];
  if (body === undefined) {
    throw new Error(
      `symbol '${id}' is missing from lucide.generated.ts; run 'pnpm generate' in packages/core`,
    );
  }
  return body;
}

function isCustomId(id: SymbolId): id is (typeof CUSTOM_IDS)[number] {
  return CUSTOM_ID_SET.has(id);
}

export function isSymbolId(x: unknown): x is SymbolId {
  return typeof x === 'string' && SYMBOL_ID_SET.has(x);
}

export function getSymbol(id: SymbolId): SymbolDef {
  return {
    id,
    body: bodyOf(id),
    source: isCustomId(id) ? 'fridgeweek' : 'lucide',
    label: symbolLabel(id),
  };
}

/**
 * Wraps a symbol body in an SVG `<symbol>` carrying the Lucide presentation
 * attributes, ready to be dropped into a `<defs>` block and referenced with
 * `<use href="#elementId">`.
 */
export function symbolToSvgSymbol(id: SymbolId, elementId: string): string {
  return `<symbol id="${elementId}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getSymbol(id).body}</symbol>`;
}

export interface SymbolLicense {
  source: SymbolSource;
  license: string;
  url: string;
  copyright: string;
}

/** Attribution for the two symbol sources. Print or link this wherever the sheet is published. */
export const SYMBOL_LICENSES: readonly SymbolLicense[] = [
  {
    source: 'lucide',
    license: `ISC (lucide-static ${LUCIDE_VERSION})`,
    url: 'https://lucide.dev/license',
    copyright:
      'Copyright (c) 2020, Lucide Contributors. Portions copyright (c) 2013-2022 Cole Bemis (Feather).',
  },
  {
    source: 'fridgeweek',
    license: 'MIT',
    url: 'https://github.com/fridgeweek/fridgeweek',
    copyright: 'Copyright (c) Fridgeweek contributors',
  },
];

export type { SymbolLabels } from './labels.js';
export { LUCIDE_VERSION, SYMBOL_LABELS, symbolLabel };
