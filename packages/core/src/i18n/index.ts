/**
 * UI chrome strings. Only the sheet's own labels live here; weekday and date strings come
 * from `Intl` in `../dates.ts`, and symbol labels live next to the symbols.
 */
import en from './locales/en.json' with { type: 'json' };
import sv from './locales/sv.json' with { type: 'json' };

export const SUPPORTED_UI_LOCALES = ['en', 'sv'] as const;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

/** Every key present in `locales/en.json`; the other bundles must match it. */
export type MessageKey = keyof typeof en;

type Bundle = Readonly<Record<MessageKey, string>>;

const BUNDLES: Readonly<Record<UiLocale, Bundle>> = { en, sv };

/** Default UI locale, used whenever a tag resolves to no supported language. */
export const DEFAULT_UI_LOCALE: UiLocale = 'en';

function languageOf(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    // Not a parseable tag: take the first subtag if it looks like a language code.
    const first = locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
    return /^[a-z]{2,3}$/.test(first) ? first : '';
  }
}

function isUiLocale(value: string): value is UiLocale {
  return (SUPPORTED_UI_LOCALES as readonly string[]).includes(value);
}

/** Match a BCP 47 tag to a supported UI language, falling back to `en`. */
export function resolveUiLocale(locale: string): UiLocale {
  const language = languageOf(locale);
  return isUiLocale(language) ? language : DEFAULT_UI_LOCALE;
}

/** All chrome strings for a locale, with English filling any gap. */
export function messages(locale: string): Bundle {
  const resolved = resolveUiLocale(locale);
  return resolved === DEFAULT_UI_LOCALE ? en : { ...en, ...BUNDLES[resolved] };
}

/** One chrome string. Falls back to English when the bundle lacks the key. */
export function t(locale: string, key: MessageKey): string {
  const bundle = BUNDLES[resolveUiLocale(locale)];
  return bundle[key] ?? en[key];
}
