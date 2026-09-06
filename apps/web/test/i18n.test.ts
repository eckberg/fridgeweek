import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import '../src/i18n/catalogues.js';
import { DEFAULT_UI_LOCALE, resolveUiLocale, t, UI_LOCALES } from '../src/i18n/index.js';
import en from '../src/i18n/locales/en.json';

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

function readLocale(code: string): Record<string, string> {
  return JSON.parse(readFileSync(join(localesDir, `${code}.json`), 'utf8'));
}

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

const englishKeys = Object.keys(en).sort();
const codes = UI_LOCALES.map((locale) => locale.code);

describe('translations', () => {
  it('ships every language listed in UI_LOCALES and nothing else', () => {
    const files = readdirSync(localesDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace('.json', ''))
      .sort();
    expect(files).toEqual([...codes].sort());
  });

  it.each(codes.filter((code) => code !== DEFAULT_UI_LOCALE))(
    '%s has exactly the English key set',
    (code) => {
      expect(Object.keys(readLocale(code)).sort()).toEqual(englishKeys);
    },
  );

  it.each(codes.filter((code) => code !== DEFAULT_UI_LOCALE))(
    '%s uses the same placeholders as English',
    (code) => {
      const messages = readLocale(code);
      for (const [key, english] of Object.entries(en)) {
        const translated = messages[key];
        expect(translated, `${code} is missing ${key}`).toBeDefined();
        expect(placeholders(translated ?? ''), `${code} ${key}`).toEqual(placeholders(english));
      }
    },
  );

  it.each(codes.filter((code) => code !== DEFAULT_UI_LOCALE))(
    '%s is actually translated, not a copy of English',
    (code) => {
      const messages = readLocale(code);
      const identical = englishKeys.filter(
        (key) => messages[key] === (en as Record<string, string>)[key],
      );
      // Proper nouns, "A4", "mm" and the like legitimately match.
      expect(
        identical.length,
        `${code} shares ${identical.length} strings with English`,
      ).toBeLessThan(englishKeys.length * 0.2);
    },
  );

  it('every language names itself and reports an English name', () => {
    for (const locale of UI_LOCALES) {
      expect(locale.endonym.length).toBeGreaterThan(1);
      expect(locale.englishName.length).toBeGreaterThan(1);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('resolveUiLocale', () => {
  it.each([
    ['sv-SE', 'sv'],
    ['sv', 'sv'],
    ['no', 'nb'],
    ['nb-NO', 'nb'],
    ['nn-NO', 'nn'],
    ['pt-BR', 'pt'],
    ['EN-GB', 'en'],
    ['xx-YY', 'en'],
    ['', 'en'],
  ])('maps %s to %s', (input, expected) => {
    expect(resolveUiLocale(input)).toBe(expected);
  });

  it('handles undefined', () => {
    expect(resolveUiLocale(undefined)).toBe('en');
  });
});

describe('t', () => {
  it('translates and falls back to English for unknown languages', () => {
    expect(t('sv', 'action.print')).toBe('Skriv ut');
    expect(t('sv-SE', 'action.print')).toBe('Skriv ut');
    expect(t('ja', 'action.print')).toBe(en['action.print']);
  });

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(t('en', 'people.count', { count: 3, max: 6 })).toBe('3 of 6');
    expect(t('en', 'people.count', { count: 3 })).toContain('{max}');
  });
});
