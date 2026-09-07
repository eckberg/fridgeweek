import { DEFAULT_CONFIG, encodeConfig, resolveConfig } from '@fridgeweek/core';
import { describe, expect, it } from 'vitest';
import {
  applyChange,
  cloneDefaults,
  loadConfig,
  saveConfig,
  shareUrl,
} from '../src/lib/sheetState.js';

/** A stand-in for `localStorage`, including the ways it can misbehave. */
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    read: (key: string) => map.get(key) ?? null,
  };
}

const throwingStorage = {
  getItem() {
    throw new DOMException('denied');
  },
  setItem() {
    throw new DOMException('denied');
  },
};

const family = resolveConfig({
  locale: 'sv-SE',
  people: [
    { name: 'Iris', symbol: 'unicorn' },
    { name: 'Milo', symbol: 'rocket' },
  ],
  linesPerDay: 2,
});

describe('loadConfig', () => {
  it("prefers the URL, because a shared link must show the sender's sheet", () => {
    const storage = memoryStorage({ 'fridgeweek.config.v1': encodeConfig(cloneDefaults()) });
    const result = loadConfig(`#${encodeConfig(family)}`, storage);
    expect(result.source).toBe('url');
    expect(result.config).toEqual(family);
  });

  it('falls back to storage when there is no hash', () => {
    const storage = memoryStorage({ 'fridgeweek.config.v1': encodeConfig(family) });
    const result = loadConfig('', storage);
    expect(result.source).toBe('storage');
    expect(result.config).toEqual(family);
  });

  it('falls back to the defaults when there is neither', () => {
    const result = loadConfig('', memoryStorage());
    expect(result.source).toBe('defaults');
    expect(result.config).toEqual(DEFAULT_CONFIG);
  });

  it('opens a link that was made before the encoding changed', () => {
    // A format 1 hash, kept verbatim: links live in message threads.
    const old =
      '#eyJ2IjoxLCJwIjpbWyJJcmlzIiwidW5pY29ybiJdLFsiTWlsbyIsInJvY2tldCJdXSwibG9jYWxlIjoic3YtU0' +
      'UiLCJsaW5lc1BlckRheSI6Mn0';
    const result = loadConfig(old, memoryStorage());
    expect(result.source).toBe('url');
    expect(result.config).toEqual(family);
  });

  it('reports a broken link rather than throwing', () => {
    const result = loadConfig('#not-a-real-config', memoryStorage());
    expect(result.source).toBe('defaults');
    expect(result.issues).toBeDefined();
  });

  it('ignores a stored value it cannot read, without complaining', () => {
    const result = loadConfig('', memoryStorage({ 'fridgeweek.config.v1': 'stale-format' }));
    expect(result.source).toBe('defaults');
    expect(result.issues).toBeUndefined();
  });

  it('survives storage being unavailable', () => {
    expect(() => loadConfig('', throwingStorage)).not.toThrow();
    expect(() => loadConfig('', null)).not.toThrow();
    expect(loadConfig('', throwingStorage).source).toBe('defaults');
  });

  it('accepts a hash with or without the leading marker', () => {
    const encoded = encodeConfig(family);
    expect(loadConfig(`#${encoded}`, null).config).toEqual(family);
    expect(loadConfig(encoded, null).config).toEqual(family);
  });
});

describe('saveConfig', () => {
  it('writes the encoded configuration and returns it', () => {
    const storage = memoryStorage();
    const encoded = saveConfig(family, storage);
    expect(storage.read('fridgeweek.config.v1')).toBe(encoded);
    expect(loadConfig('', storage).config).toEqual(family);
  });

  it('still returns the encoding when storage refuses', () => {
    expect(saveConfig(family, throwingStorage)).toBe(encodeConfig(family));
    expect(saveConfig(family, null)).toBe(encodeConfig(family));
  });
});

describe('applyChange', () => {
  it('applies a valid change', () => {
    const { config, issues } = applyChange(family, { linesPerDay: 4 });
    expect(config.linesPerDay).toBe(4);
    expect(issues).toEqual([]);
  });

  it('keeps the previous configuration when a change would be invalid', () => {
    const { config, issues } = applyChange(family, { linesPerDay: 9 });
    expect(config).toEqual(family);
    expect(issues[0]?.path).toBe('linesPerDay');
  });

  it('treats a removed week start as undated rather than as an invalid date', () => {
    const dated = resolveConfig({ ...family, weekStarting: '2026-09-07' });
    const { weekStarting: _drop, ...undated } = dated;
    const { config, issues } = applyChange(undated as typeof dated, {});
    expect(issues).toEqual([]);
    expect(config.weekStarting).toBeUndefined();
  });
});

describe('shareUrl', () => {
  it('builds a link that reproduces the sheet', () => {
    const url = shareUrl('https://fridgeweek.example', '/sheet', family);
    expect(url.startsWith('https://fridgeweek.example/sheet#')).toBe(true);
    expect(loadConfig(url.slice(url.indexOf('#')), null).config).toEqual(family);
  });
});

describe('cloneDefaults', () => {
  it('never hands out the shared default people array', () => {
    const a = cloneDefaults();
    const b = cloneDefaults();
    expect(a).toEqual(b);
    expect(a.people).not.toBe(b.people);
    const first = a.people[0];
    expect(first).toBeDefined();
    if (first) first.name = 'Changed';
    expect(b.people[0]?.name).not.toBe('Changed');
    expect(DEFAULT_CONFIG.people[0]?.name).not.toBe('Changed');
  });
});
