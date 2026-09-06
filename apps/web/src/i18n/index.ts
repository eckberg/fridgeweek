import en from './locales/en.json';

/**
 * UI chrome strings for the site. The sheet itself takes its few printed words
 * from `@fridgeweek/core`; everything a person reads on screen lives here.
 *
 * Adding a language is one JSON file plus one line in `UI_LOCALES`. Keys that a
 * translation has not covered yet fall back to English rather than breaking, so
 * a partial translation is still worth shipping.
 */

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export interface UiLocale {
  /** BCP 47 tag used for `<html lang>` and for `Intl`. */
  code: string;
  /** The language's own name for itself, shown in the picker. */
  endonym: string;
  /** English name, used for sorting and for the `header.snapped` hint. */
  englishName: string;
}

/**
 * Every language the interface is available in. The Nordic languages come
 * first because that is where the sheet comes from, then the rest in
 * alphabetical order by code.
 */
export const UI_LOCALES: readonly UiLocale[] = [
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

export const DEFAULT_UI_LOCALE = 'en';

const catalogues = new Map<string, Partial<Messages>>([['en', en]]);

/** Registers a translation. Called by the generated locale barrel. */
export function registerCatalogue(code: string, messages: Partial<Messages>): void {
  catalogues.set(code, messages);
}

/** Resolves any BCP 47 tag to a language the interface actually has. */
export function resolveUiLocale(locale: string | undefined): string {
  if (!locale) return DEFAULT_UI_LOCALE;
  const lower = locale.toLowerCase();
  const exact = UI_LOCALES.find((l) => l.code === lower);
  if (exact) return exact.code;
  const language = lower.split(/[-_]/)[0] ?? '';
  const byLanguage = UI_LOCALES.find((l) => l.code === language);
  if (byLanguage) return byLanguage.code;
  // Norwegian without a written standard, and the macrolanguage tag, mean Bokmål.
  if (language === 'no') return 'nb';
  return DEFAULT_UI_LOCALE;
}

/**
 * Looks up a string, falling back to English for keys a translation has not
 * covered. `params` fills `{name}` placeholders.
 */
export function t(
  locale: string,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const resolved = resolveUiLocale(locale);
  const template = catalogues.get(resolved)?.[key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** A bound `t` for a single locale, which is what components want. */
export function translator(
  locale: string,
): (key: MessageKey, params?: Record<string, string | number>) => string {
  return (key, params) => t(locale, key, params);
}

const ENGLISH: UiLocale = { code: 'en', endonym: 'English', englishName: 'English' };

export function localeMeta(code: string): UiLocale {
  const resolved = resolveUiLocale(code);
  return UI_LOCALES.find((l) => l.code === resolved) ?? ENGLISH;
}
