import type { SymbolId } from './index.js';
import da from './labels/da.json';
import de from './labels/de.json';
import en from './labels/en.json';
import es from './labels/es.json';
import fi from './labels/fi.json';
import fo from './labels/fo.json';
import fr from './labels/fr.json';
import is from './labels/is.json';
import it from './labels/it.json';
import nb from './labels/nb.json';
import nl from './labels/nl.json';
import nn from './labels/nn.json';
import pl from './labels/pl.json';
import pt from './labels/pt.json';
import sv from './labels/sv.json';

/**
 * Human names for the symbols, used by the legend, the picker and by screen
 * readers. They are never printed on the sheet itself: the sheet shows the
 * drawing, because that is the point of it.
 *
 * English is complete by construction, and every other language falls back to
 * it key by key, so a translation that misses a symbol is still worth shipping.
 * Adding a language is one JSON file plus one line below.
 */

/** English is the contract: a symbol without an English label is a type error. */
export type SymbolLabels = Record<SymbolId, string>;

const ENGLISH: SymbolLabels = en;

const TRANSLATIONS: Record<string, Partial<SymbolLabels>> = {
  en: ENGLISH,
  sv,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  de,
  es,
  fr,
  it,
  nl,
  pl,
  pt,
};

export const LABEL_LANGUAGES: readonly string[] = Object.keys(TRANSLATIONS);

/**
 * The label for a symbol in the closest language available.
 *
 * `locale` may be any BCP 47 tag; only the language subtag is used, since a
 * cat is a cat in every region.
 */
export function symbolLabel(id: SymbolId, locale = 'en'): string {
  const language = locale.toLowerCase().split(/[-_]/)[0] ?? 'en';
  return TRANSLATIONS[language]?.[id] ?? ENGLISH[id];
}

/** Every language's label for one symbol, for callers that switch locale often. */
export function symbolLabels(id: SymbolId): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [language, table] of Object.entries(TRANSLATIONS)) {
    out[language] = table[id] ?? ENGLISH[id];
  }
  return out;
}
