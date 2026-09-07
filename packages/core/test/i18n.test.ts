import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHEET_LOCALE,
  type MessageKey,
  messages,
  resolveSheetLocale,
  SHEET_LOCALES,
  sheetLocaleMeta,
  t,
} from '../src/i18n/index.js';

const KEYS: MessageKey[] = ['sheet.week', 'sheet.family'];
const codes = SHEET_LOCALES.map((locale) => locale.code);

describe('sheet locales', () => {
  it('defaults to English', () => {
    expect(DEFAULT_SHEET_LOCALE).toBe('en');
    expect(codes[0]).toBe('en');
  });

  it('lists each language once, with its own name for itself', () => {
    expect(new Set(codes).size).toBe(codes.length);
    for (const locale of SHEET_LOCALES) {
      expect(locale.endonym.trim().length).toBeGreaterThan(1);
      expect(locale.englishName.trim().length).toBeGreaterThan(1);
    }
  });

  it.each(codes)('%s translates every printed word', (code) => {
    const bundle = messages(code);
    expect(Object.keys(bundle).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      expect(bundle[key].trim().length, `${code} ${key}`).toBeGreaterThan(0);
    }
  });

  it('translates the words that actually reach paper', () => {
    expect(t('sv', 'sheet.week')).toBe('Vecka');
    expect(t('sv-SE', 'sheet.week')).toBe('Vecka');
    expect(t('de-AT', 'sheet.week')).toBe('Woche');
    expect(t('fi', 'sheet.family')).toBe('Kaikki');
    expect(t('pl', 'sheet.week')).toBe('Tydzień');
  });

  it('falls back to English for a language it has no words for', () => {
    // The sheet is still correct: weekday names and dates come from Intl.
    expect(t('ja-JP', 'sheet.week')).toBe('Week');
    expect(t('not a locale', 'sheet.week')).toBe('Week');
  });
});

describe('resolveSheetLocale', () => {
  it.each([
    ['sv-SE', 'sv'],
    ['sv', 'sv'],
    ['no', 'nb'],
    ['nb-NO', 'nb'],
    ['nn-NO', 'nn'],
    ['pt-BR', 'pt'],
    ['EN-GB', 'en'],
    ['ja-JP', 'en'],
    ['', 'en'],
    ['not a locale', 'en'],
  ])('maps %s to %s', (input, expected) => {
    expect(resolveSheetLocale(input)).toBe(expected);
  });
});

describe('sheetLocaleMeta', () => {
  it('names the language for a picker', () => {
    expect(sheetLocaleMeta('sv-SE').endonym).toBe('Svenska');
    expect(sheetLocaleMeta('fo').englishName).toBe('Faroese');
    expect(sheetLocaleMeta('ja').code).toBe('en');
  });
});
