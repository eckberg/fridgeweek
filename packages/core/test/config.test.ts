import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_CONFIG,
  decodeConfig,
  encodeConfig,
  personInitial,
  resolveConfig,
  validateConfig,
} from '../src/config.js';

const people = [
  { name: 'Ava', symbol: 'unicorn' },
  { name: 'Harry', symbol: 'dinosaur' },
  { name: 'Sara', symbol: 'flower' },
  { name: 'Karl', symbol: 'rocket', initial: 'K' },
];

describe('resolveConfig', () => {
  it('applies defaults to an empty input', () => {
    const config = resolveConfig({});
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(config.people).not.toBe(DEFAULT_CONFIG.people);
  });

  it('accepts a full config', () => {
    const config = resolveConfig({
      locale: 'sv-SE',
      paper: 'Letter',
      marginMm: 8,
      weekStart: 'monday',
      showWeekNumber: true,
      showDateRange: false,
      showDayDates: true,
      showLegend: true,
      weekStarting: '2026-09-07',
      people,
      markStyle: 'initial',
      familyMark: false,
      linesPerDay: 4,
      weekendStyle: 'plain',
      copies: 5,
    });
    expect(config.locale).toBe('sv-SE');
    expect(config.people).toHaveLength(4);
    expect(config.people[3]?.initial).toBe('K');
    expect(config.weekStarting).toBe('2026-09-07');
  });

  it('canonicalises the locale tag', () => {
    expect(resolveConfig({ locale: 'SV-se' }).locale).toBe('sv-SE');
  });

  it('trims names', () => {
    expect(resolveConfig({ people: [{ name: '  Bo ', symbol: 'cat' }] }).people[0]?.name).toBe(
      'Bo',
    );
  });

  it.each([
    [{ paper: 'A5' }, 'paper'],
    [{ marginMm: 4 }, 'marginMm'],
    [{ marginMm: 21 }, 'marginMm'],
    [{ marginMm: '10' }, 'marginMm'],
    [{ linesPerDay: 0 }, 'linesPerDay'],
    [{ linesPerDay: 5 }, 'linesPerDay'],
    [{ linesPerDay: 2.5 }, 'linesPerDay'],
    [{ copies: 21 }, 'copies'],
    [{ weekStart: 'friday' }, 'weekStart'],
    [{ markStyle: 'colour' }, 'markStyle'],
    [{ weekendStyle: 'bold' }, 'weekendStyle'],
    [{ showWeekNumber: 'yes' }, 'showWeekNumber'],
    [{ showLegend: 1 }, 'showLegend'],
    [{ weekStarting: '2026-02-30' }, 'weekStarting'],
    [{ weekStarting: '7 sep' }, 'weekStarting'],
    [{ locale: 'not a locale' }, 'locale'],
    [{ locale: '' }, 'locale'],
    [{ people: [] }, 'people'],
    [{ people: 'Ava' }, 'people'],
    [{ people: Array(7).fill({ name: 'X', symbol: 'cat' }) }, 'people'],
    [{ people: [{ name: '', symbol: 'cat' }] }, 'people[0].name'],
    [{ people: [{ name: 'A'.repeat(25), symbol: 'cat' }] }, 'people[0].name'],
    [{ people: [{ name: 'Ava', symbol: 'dragon' }] }, 'people[0].symbol'],
    [{ people: [{ name: 'Ava', symbol: 'cat', initial: 'AVA' }] }, 'people[0].initial'],
    [{ people: [{ name: 'Ava', symbol: 'cat', initial: '' }] }, 'people[0].initial'],
    [{ people: [{ name: 'Ava', symbol: 'cat', colour: 'red' }] }, 'people[0].colour'],
    [{ version: 2 }, 'version'],
    [{ bogus: true }, 'bogus'],
  ])('rejects %j at %s', (input, path) => {
    const result = validateConfig(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.path)).toContain(path);
    }
  });

  it('reports every issue at once', () => {
    const result = validateConfig({ paper: 'A5', copies: 0, people: [{ name: '', symbol: 'x' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(4);
  });

  it('throws ConfigError with issues attached', () => {
    expect(() => resolveConfig({ paper: 'A5' })).toThrow(ConfigError);
    try {
      resolveConfig({ paper: 'A5' });
    } catch (e) {
      expect((e as ConfigError).issues[0]?.path).toBe('paper');
    }
  });

  it('rejects non-objects', () => {
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig([]).ok).toBe(false);
    expect(validateConfig('x').ok).toBe(false);
  });
});

describe('personInitial', () => {
  it('uses the explicit initial, else the first character', () => {
    expect(personInitial({ name: 'Karl', symbol: 'cat', initial: 'KE' })).toBe('KE');
    expect(personInitial({ name: 'Åsa', symbol: 'cat' })).toBe('Å');
    expect(personInitial({ name: '👧 Ava', symbol: 'cat' })).toBe('👧');
  });
});

describe('encodeConfig / decodeConfig', () => {
  it('round-trips the defaults compactly', () => {
    const encoded = encodeConfig(DEFAULT_CONFIG);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeConfig(encoded)).toEqual(DEFAULT_CONFIG);
    expect(encoded.length).toBeLessThan(80);
  });

  it('round-trips a full config including unicode names', () => {
    const config = resolveConfig({
      locale: 'sv-SE',
      paper: 'Letter',
      weekStarting: '2026-09-07',
      people: [
        { name: 'Åsa Öberg', symbol: 'unicorn' },
        { name: '李小龙', symbol: 'dinosaur', initial: '李' },
      ],
      markStyle: 'initial',
      linesPerDay: 2,
      copies: 3,
    });
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
  });

  it('only encodes fields that differ from the defaults', () => {
    const config = resolveConfig({ people, linesPerDay: 2 });
    const json = JSON.parse(Buffer.from(encodeConfig(config), 'base64url').toString('utf8'));
    expect(Object.keys(json).sort()).toEqual(['linesPerDay', 'p', 'v']);
    expect(json.p[3]).toEqual(['Karl', 'rocket', 'K']);
  });

  it('rejects garbage, wrong versions and invalid payloads', () => {
    expect(() => decodeConfig('not base64!')).toThrow(ConfigError);
    expect(() => decodeConfig(Buffer.from('{"v":2}').toString('base64url'))).toThrow(ConfigError);
    expect(() => decodeConfig(Buffer.from('{"v":1,"paper":"A5"}').toString('base64url'))).toThrow(
      ConfigError,
    );
    expect(() => decodeConfig(Buffer.from('{"v":1,"p":"x"}').toString('base64url'))).toThrow(
      ConfigError,
    );
  });
});
