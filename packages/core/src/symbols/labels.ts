import type { SymbolId } from './index.js';
import en from './labels/en.json' with { type: 'json' };

/**
 * Names for the symbols, used by the picker, the legend on screen and by screen
 * readers. They are never printed on the sheet: the sheet shows the drawing,
 * which is the whole point of it.
 *
 * English only, deliberately. The sheet is translated because it is the output;
 * the interface around it is not.
 */

/** A symbol without a name is a type error. */
export type SymbolLabels = Record<SymbolId, string>;

export const SYMBOL_LABELS: SymbolLabels = en;

export function symbolLabel(id: SymbolId): string {
  return SYMBOL_LABELS[id];
}
