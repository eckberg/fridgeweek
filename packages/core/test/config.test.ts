import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_CONFIG,
  personInitial,
  resolveConfig,
  validateConfig,
} from '../src/config.js';

const people = [
  { name: 'Iris', symbol: 'unicorn' },
  { name: 'Otto', symbol: 'dinosaur' },
  { name: 'Vera', symbol: 'flower' },
  { name: 'Milo', symbol: 'rocket', initial: 'M' },
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
    expect(config.people[3]?.initial).toBe('M');
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
    [{ copies: 26 }, 'copies'],
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
    [{ people: 'Iris' }, 'people'],
    [{ people: Array(7).fill({ name: 'X', symbol: 'cat' }) }, 'people'],
    [{ people: [{ name: '', symbol: 'cat' }] }, 'people[0].name'],
    [{ people: [{ name: 'A'.repeat(25), symbol: 'cat' }] }, 'people[0].name'],
    [{ people: [{ name: 'Iris', symbol: 'dragon' }] }, 'people[0].symbol'],
    [{ people: [{ name: 'Iris', symbol: 'cat', initial: 'IRIS' }] }, 'people[0].initial'],
    [{ people: [{ name: 'Iris', symbol: 'cat', initial: '' }] }, 'people[0].initial'],
    [{ people: [{ name: 'Iris', symbol: 'cat', colour: 'red' }] }, 'people[0].colour'],
    [
      {
        people: [
          { name: 'Iris', symbol: 'cat' },
          { name: 'Bo', symbol: 'cat' },
        ],
      },
      'people[1].symbol',
    ],
    [
      {
        markStyle: 'initial',
        people: [
          { name: 'Vera', symbol: 'cat' },
          { name: 'Viktor', symbol: 'dog' },
        ],
      },
      'people[1].initial',
    ],
    [{ version: 2 }, 'version'],
    [{ bogus: true }, 'bogus'],
  ])('rejects %j at %s', (input, path) => {
    const result = validateConfig(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.path)).toContain(path);
    }
  });

  it('allows the same first letter when a distinct initial is given, and in symbol mode', () => {
    const people = [
      { name: 'Vera', symbol: 'cat' },
      { name: 'Viktor', symbol: 'dog', initial: 'Vk' },
    ];
    expect(validateConfig({ markStyle: 'initial', people }).ok).toBe(true);
    expect(
      validateConfig({
        people: [
          { name: 'Vera', symbol: 'cat' },
          { name: 'Viktor', symbol: 'dog' },
        ],
      }).ok,
    ).toBe(true);
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
    expect(personInitial({ name: 'Milo', symbol: 'cat', initial: 'ML' })).toBe('ML');
    expect(personInitial({ name: 'Åsa', symbol: 'cat' })).toBe('Å');
    expect(personInitial({ name: '👧 Iris', symbol: 'cat' })).toBe('👧');
  });
});
