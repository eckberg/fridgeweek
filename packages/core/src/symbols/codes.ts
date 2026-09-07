/**
 * Stable numbers for symbol ids, used by the URL encoder.
 *
 * A shared link is meant to keep working, so the number that stands for a
 * symbol can never change. This list is therefore **append-only**: a new symbol
 * goes on the end, whatever the alphabet says. `SYMBOL_IDS` stays sorted for
 * the picker; this order belongs to the wire format and nothing else.
 *
 * A test fails when a symbol is missing from the list, listed twice, or listed
 * without existing.
 */
import type { SymbolId } from './index.js';

/** Symbol ids by code. Append only; never reorder, never remove. */
export const SYMBOL_CODES: readonly SymbolId[] = [
  'anchor',
  'apple',
  'bike',
  'bird',
  'book',
  'bot',
  'bus',
  'candy',
  'car',
  'cat',
  'cherry',
  'cloud',
  'crown',
  'dice-5',
  'dinosaur',
  'dog',
  'drum',
  'firefighter-helmet',
  'fish',
  'flame',
  'flower',
  'footprints',
  'gamepad-2',
  'ghost',
  'gift',
  'glasses',
  'guitar',
  'hammer',
  'heart',
  'house',
  'ice-cream-cone',
  'leaf',
  'lollipop',
  'medal',
  'moon',
  'mountain-snow',
  'music',
  'pizza',
  'plane',
  'puzzle',
  'rabbit',
  'rainbow',
  'rocket',
  'sailboat',
  'shell',
  'shield',
  'ship',
  'smile',
  'snail',
  'squirrel',
  'star',
  'sun',
  'sword',
  'tiara',
  'tractor',
  'train-front',
  'tree-pine',
  'trophy',
  'turtle',
  'umbrella',
  'unicorn',
  'users',
  'wand-sparkles',
  'wrench',
  'zap',
];

/**
 * A code is one byte, so the set can hold 256 symbols. Passing that number is a
 * format change, not a table change: the encoder would have to spend a second
 * byte per person.
 */
export const MAX_SYMBOL_CODES = 256;

const CODE_BY_ID: ReadonlyMap<string, number> = new Map(
  SYMBOL_CODES.map((id, code) => [id as string, code]),
);

/** The code for a symbol, or `undefined` for a symbol missing from the table. */
export function symbolCode(id: SymbolId): number | undefined {
  return CODE_BY_ID.get(id);
}

/** The symbol a code stands for, or `undefined` when the code is not in use. */
export function symbolFromCode(code: number): SymbolId | undefined {
  return SYMBOL_CODES[code];
}
