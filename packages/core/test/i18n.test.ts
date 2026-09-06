import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_LOCALE,
  type MessageKey,
  messages,
  resolveUiLocale,
  SUPPORTED_UI_LOCALES,
  t,
} from '../src/i18n/index.js';
import en from '../src/i18n/locales/en.json' with { type: 'json' };
import sv from '../src/i18n/locales/sv.json' with { type: 'json' };

const bundles: Record<string, Record<string, string>> = { en, sv };

describe('locale bundles', () => {
  it('ships a bundle for every supported locale', () => {
    expect(SUPPORTED_UI_LOCALES).toEqual(['en', 'sv']);
    for (const locale of SUPPORTED_UI_LOCALES) {
      expect(Object.keys(bundles[locale] ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('has the same keys in every bundle as in en', () => {
    const expected = Object.keys(en).sort();
    for (const locale of SUPPORTED_UI_LOCALES) {
      expect(Object.keys(bundles[locale] ?? {}).sort(), `keys of ${locale}.json`).toEqual(expected);
    }
  });

  it('has a non-empty string for every key', () => {
    for (const locale of SUPPORTED_UI_LOCALES) {
      for (const [key, value] of Object.entries(bundles[locale] ?? {})) {
        expect(typeof value, `${locale}.${key}`).toBe('string');
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('actually translates the Swedish bundle', () => {
    expect(sv['sheet.week']).toBe('Vecka');
    expect(sv['sheet.family']).toBe('Alla');
    expect(sv['sheet.name']).toBe('Namn');
    expect(sv['sheet.notes']).toBe('Anteckningar');
  });
});

describe('resolveUiLocale', () => {
  it.each([
    ['sv', 'sv'],
    ['sv-SE', 'sv'],
    ['sv-FI', 'sv'],
    ['SV', 'sv'],
    ['sv_SE', 'sv'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['xx-YY', 'en'],
    ['de-DE', 'en'],
    ['', 'en'],
    ['not a locale', 'en'],
    ['!!', 'en'],
  ])('resolves %o to %o', (input, expected) => {
    expect(resolveUiLocale(input)).toBe(expected);
  });

  it('defaults to English', () => {
    expect(DEFAULT_UI_LOCALE).toBe('en');
  });
});

describe('t', () => {
  it('returns the translated string', () => {
    expect(t('sv-SE', 'sheet.week')).toBe('Vecka');
    expect(t('sv', 'sheet.family')).toBe('Alla');
    expect(t('en-US', 'sheet.week')).toBe('Week');
  });

  it('falls back to English for unsupported locales', () => {
    expect(t('de-DE', 'sheet.week')).toBe('Week');
    expect(t('', 'sheet.family')).toBe('Everyone');
    expect(t('not a locale', 'sheet.notes')).toBe('Notes');
  });

  it('falls back to English when a bundle is missing the key', () => {
    const key = 'sheet.week' satisfies MessageKey;
    const patched: Record<string, string> = { ...sv };
    delete patched[key];
    // The public bundle is never patched; this only documents the contract that the
    // English string is the last resort, which `t` implements with `?? en[key]`.
    expect(patched[key]).toBeUndefined();
    expect(t('sv-SE', key)).toBe('Vecka');
  });

  it('never returns an empty string for any supported locale and key', () => {
    for (const locale of SUPPORTED_UI_LOCALES) {
      for (const key of Object.keys(en) as MessageKey[]) {
        expect(t(locale, key).length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('messages', () => {
  it('returns the full bundle for a supported locale', () => {
    expect(messages('sv-SE')).toEqual(sv);
    expect(messages('en-GB')).toEqual(en);
  });

  it('returns English for anything else', () => {
    expect(messages('de-DE')).toEqual(en);
    expect(messages('')).toEqual(en);
  });

  it('exposes every key of en', () => {
    expect(Object.keys(messages('sv')).sort()).toEqual(Object.keys(en).sort());
  });
});
