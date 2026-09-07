import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type MessageKey, t } from '../src/i18n/index.js';
import en from '../src/i18n/locales/en.json';

/**
 * The interface is English. What is worth guarding is that the catalogue and
 * the code agree: every string the code asks for exists, and no string sits
 * unused pretending the product still says it.
 */

const sourceDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function sourceFiles(dir: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|vue|astro)$/.test(entry) ? [full] : [];
  });
}

const sources = sourceFiles(sourceDir).map((file) => readFileSync(file, 'utf8'));
const usedKeys = new Set(
  sources.flatMap((text) => [...text.matchAll(/\bt\(\s*'([\w.]+)'/g)].map((m) => m[1] ?? '')),
);

describe('the message catalogue', () => {
  it('has a string for every key the code asks for', () => {
    const missing = [...usedKeys].filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });

  it('has no strings the product no longer says', () => {
    const unused = Object.keys(en).filter((key) => !usedKeys.has(key));
    expect(unused).toEqual([]);
  });

  it('has no empty strings', () => {
    const blank = Object.entries(en).filter(([, value]) => value.trim().length === 0);
    expect(blank).toEqual([]);
  });
});

describe('t', () => {
  it('returns the string', () => {
    expect(t('action.print')).toBe('Print');
  });

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(t('people.count', { count: 3, max: 6 })).toBe('3 of 6');
    expect(t('people.count' as MessageKey, { count: 3 })).toContain('{max}');
  });
});
