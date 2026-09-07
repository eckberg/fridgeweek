import da from './locales/da.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import fi from './locales/fi.json' with { type: 'json' };
import fo from './locales/fo.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import is from './locales/is.json' with { type: 'json' };
import it from './locales/it.json' with { type: 'json' };
import nb from './locales/nb.json' with { type: 'json' };
import nl from './locales/nl.json' with { type: 'json' };
import nn from './locales/nn.json' with { type: 'json' };
import pl from './locales/pl.json' with { type: 'json' };
import pt from './locales/pt.json' with { type: 'json' };
import sv from './locales/sv.json' with { type: 'json' };

/**
 * The handful of words actually printed on a sheet.
 *
 * Almost everything on the page is either handwriting or comes from `Intl`:
 * weekday names, day dates and the date range are all locale data, which is why
 * a sheet prints correctly in far more languages than are listed here. Only two
 * words are the project's own, and this is where they are translated.
 *
 * Symbol names are not among them. They appear in the picker on screen, never
 * on paper, and the interface is English.
 */

export type MessageKey = keyof typeof en;
type Bundle = Readonly<Record<MessageKey, string>>;

export interface SheetLocale {
  /** BCP 47 language subtag, which is what a `SheetConfig.locale` may be set to. */
  code: string;
  /** The language's own name for itself. */
  endonym: string;
  englishName: string;
}

/**
 * The languages a sheet can be printed in with every printed word correct.
 * Nordic first, since that is where the sheet comes from, then the rest by code.
 */
export const SHEET_LOCALES: readonly SheetLocale[] = [
  { code: 'en', endonym: 'English', englishName: 'English' },
  { code: 'sv', endonym: 'Svenska', englishName: 'Swedish' },
  { code: 'da', endonym: 'Dansk', englishName: 'Danish' },
  { code: 'nb', endonym: 'Norsk bokmål', englishName: 'Norwegian Bokmål' },
  { code: 'nn', endonym: 'Nynorsk', englishName: 'Norwegian Nynorsk' },
  { code: 'fi', endonym: 'Suomi', englishName: 'Finnish' },
  { code: 'is', endonym: 'Íslenska', englishName: 'Icelandic' },
  { code: 'fo', endonym: 'Føroyskt', englishName: 'Faroese' },
  { code: 'de', endonym: 'Deutsch', englishName: 'German' },
  { code: 'es', endonym: 'Español', englishName: 'Spanish' },
  { code: 'fr', endonym: 'Français', englishName: 'French' },
  { code: 'it', endonym: 'Italiano', englishName: 'Italian' },
  { code: 'nl', endonym: 'Nederlands', englishName: 'Dutch' },
  { code: 'pl', endonym: 'Polski', englishName: 'Polish' },
  { code: 'pt', endonym: 'Português', englishName: 'Portuguese' },
];

const BUNDLES: Readonly<Record<string, Bundle>> = {
  en,
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

export const DEFAULT_SHEET_LOCALE = 'en';

function languageOf(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    // Not a parseable tag: take the first subtag if it looks like a language code.
    const first = locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
    return /^[a-z]{2,3}$/.test(first) ? first : '';
  }
}

/**
 * Matches a BCP 47 tag to a language the sheet has words for. A locale with no
 * translation still produces a correct sheet: the weekday names and dates come
 * from `Intl`, and these two words fall back to English.
 */
export function resolveSheetLocale(locale: string): string {
  const language = languageOf(locale);
  // Norwegian without a written standard, and the macrolanguage tag, mean Bokmål.
  const normalised = language === 'no' ? 'nb' : language;
  return normalised in BUNDLES ? normalised : DEFAULT_SHEET_LOCALE;
}

/** Metadata for a locale, falling back to English. */
export function sheetLocaleMeta(locale: string): SheetLocale {
  const code = resolveSheetLocale(locale);
  return SHEET_LOCALES.find((entry) => entry.code === code) ?? ENGLISH_META;
}

const ENGLISH_META: SheetLocale = { code: 'en', endonym: 'English', englishName: 'English' };

export function t(locale: string, key: MessageKey): string {
  return BUNDLES[resolveSheetLocale(locale)]?.[key] ?? en[key];
}

export function messages(locale: string): Bundle {
  return BUNDLES[resolveSheetLocale(locale)] ?? en;
}
