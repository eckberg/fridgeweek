import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_CONFIG, resolveConfig, type SheetConfig } from '../src/config.js';
import { decodeConfig, encodeConfig } from '../src/encoding.js';
import { SYMBOL_IDS } from '../src/symbols/index.js';

/**
 * A link made before the packed format existed. Kept verbatim: someone has this
 * in a message thread, and it has to keep opening the same sheet.
 */
const FORMAT_1_LINK =
  'eyJ2IjoxLCJwIjpbWyJBbGV4IiwiY2F0IiwiSyJdLFsiU2FtIiwicm9ja2V0Il1dLCJsb2NhbGUiOiJzdiIsInNo' +
  'b3dXZWVrTnVtYmVyIjp0cnVlLCJzaG93RGF5RGF0ZXMiOmZhbHNlLCJ3ZWVrU3RhcnRpbmciOiIyMDI2LTA5LTA3' +
  'IiwibWFya1N0eWxlIjoiaW5pdGlhbCIsImxpbmVzUGVyRGF5IjoyLCJjb3BpZXMiOjV9';

/**
 * What that link says, written the way it is written today. Its sheet-wide
 * `markStyle: 'initial'` is now a property of each person, so Sam gets the
 * initial that flag used to draw for him, and its five copies of one dated
 * week are the five weeks after that date.
 */
const shared = resolveConfig({
  locale: 'sv',
  showWeekNumber: true,
  showDayDates: false,
  weekStarting: '2026-09-07',
  linesPerDay: 2,
  weeks: 5,
  people: [
    { name: 'Alex', symbol: 'cat', initial: 'K' },
    { name: 'Sam', symbol: 'rocket', initial: 'S' },
  ],
});

function bytesOf(encoded: string): Buffer {
  return Buffer.from(encoded, 'base64url');
}

function linkOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

describe('encodeConfig', () => {
  it('writes a short, URL-safe, deterministic string', () => {
    const encoded = encodeConfig(shared);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).toBe(encodeConfig(shared));
    // Pinned so that a change to the byte layout or to a symbol's number is
    // visible in review: both would break links people have already shared.
    expect(encoded).toBe('ApBRJCYSAnN2CYRBbGV4AUsqg1NhbQFT');
  });

  it('is a fraction of the length of the format 1 link for the same sheet', () => {
    expect(encodeConfig(shared).length).toBeLessThan(FORMAT_1_LINK.length / 4);
  });

  it('spends nothing on fields that are already the default', () => {
    expect(encodeConfig(DEFAULT_CONFIG)).toHaveLength(20);
  });

  it('grows only with the names', () => {
    const short = resolveConfig({ people: [{ name: 'Bo', symbol: 'cat' }] });
    const long = resolveConfig({ people: [{ name: 'Bo Bergström-Lind', symbol: 'cat' }] });
    expect(encodeConfig(long).length).toBeGreaterThan(encodeConfig(short).length);
  });
});

describe('encodeConfig / decodeConfig', () => {
  it('round-trips the defaults', () => {
    expect(decodeConfig(encodeConfig(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips every field at a non-default value, with six unicode people', () => {
    const config = resolveConfig({
      locale: 'sv-SE',
      paper: 'Letter',
      marginMm: 20,
      weekStart: 'sunday',
      showWeekNumber: false,
      showDateRange: false,
      showDayDates: false,
      showLegend: false,
      weekStarting: '2026-09-07',
      familyMark: false,
      linesPerDay: 4,
      weekendStyle: 'plain',
      weeks: 25,
      people: [
        { name: 'Åsa Öberg', symbol: 'unicorn', initial: 'Ås' },
        { name: '李小龙', symbol: 'dinosaur', initial: '李' },
        { name: '👧 Iris', symbol: 'zap', initial: '👧' },
        { name: 'Milo', symbol: 'rocket' },
        { name: 'Vera', symbol: 'flower' },
        { name: 'Otto', symbol: 'anchor' },
      ],
    });
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
  });

  it.each([
    ['auto', 'auto'],
    ['true', true],
    ['false', false],
  ] as const)('round-trips showWeekNumber %s', (_label, value) => {
    const config = resolveConfig({ showWeekNumber: value });
    expect(decodeConfig(encodeConfig(config)).showWeekNumber).toBe(value);
  });

  it('round-trips every symbol, so no mark is lost to its number', () => {
    for (const symbol of SYMBOL_IDS) {
      const config = resolveConfig({ people: [{ name: 'Bo', symbol }] });
      expect(decodeConfig(encodeConfig(config)).people[0]?.symbol).toBe(symbol);
    }
  });

  it('round-trips a margin of a whole tenth of a millimetre', () => {
    const config = resolveConfig({ marginMm: 12.5 });
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
    expect(bytesOf(encodeConfig(config))[0]).toBe(2);
  });

  it('falls back to format 1 for a margin the packed format cannot hold', () => {
    const config = resolveConfig({ marginMm: 10.25 });
    expect(bytesOf(encodeConfig(config))[0]).toBe('{'.charCodeAt(0));
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
  });

  it('falls back to format 1 for a date outside the packed range', () => {
    const config = resolveConfig({ weekStarting: '1999-12-27' });
    expect(bytesOf(encodeConfig(config))[0]).toBe('{'.charCodeAt(0));
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
  });

  it.each(['2000-01-01', '2026-09-07', '2179-06-06'])('round-trips the date %s', (weekStarting) => {
    const config = resolveConfig({ weekStarting });
    expect(decodeConfig(encodeConfig(config)).weekStarting).toBe(weekStarting);
  });
});

describe('decodeConfig', () => {
  it('still reads a link written in format 1', () => {
    expect(decodeConfig(FORMAT_1_LINK)).toEqual(shared);
  });

  it('still reads the packed flag for a sheet-wide mark style', () => {
    const bytes = bytesOf(encodeConfig(DEFAULT_CONFIG));
    bytes[1] = (bytes[1] as number) | 0x02;
    const config = decodeConfig(linkOf(bytes));
    expect(config.people.map((p) => p.initial)).toEqual(['A', 'S']);
    // Written again, the same sheet says it person by person.
    expect(bytesOf(encodeConfig(config))[1]).toBe(0);
  });

  it('shortens that link when the sheet is saved again', () => {
    const shortened = encodeConfig(decodeConfig(FORMAT_1_LINK));
    expect(decodeConfig(shortened)).toEqual(shared);
    expect(shortened.length).toBeLessThan(FORMAT_1_LINK.length);
  });

  it('rejects garbage, wrong versions and invalid format 1 payloads', () => {
    expect(() => decodeConfig('not base64!')).toThrow(ConfigError);
    expect(() => decodeConfig('')).toThrow(ConfigError);
    expect(() => decodeConfig(Buffer.from('{"v":2}').toString('base64url'))).toThrow(ConfigError);
    expect(() => decodeConfig(Buffer.from('{"v":1,"paper":"A5"}').toString('base64url'))).toThrow(
      ConfigError,
    );
    expect(() => decodeConfig(Buffer.from('{"v":1,"p":"x"}').toString('base64url'))).toThrow(
      ConfigError,
    );
  });

  it('rejects an unknown format', () => {
    expect(() => decodeConfig(linkOf(Uint8Array.of(9, 0, 0, 0)))).toThrow(/version/);
  });

  it('rejects a packed payload that is truncated or padded', () => {
    const bytes = bytesOf(encodeConfig(shared));
    expect(() => decodeConfig(linkOf(bytes.subarray(0, bytes.length - 1)))).toThrow(ConfigError);
    expect(() => decodeConfig(linkOf(Buffer.concat([bytes, Buffer.of(0)])))).toThrow(ConfigError);
  });

  it('names the person whose symbol number it does not know', () => {
    const bytes = bytesOf(encodeConfig(DEFAULT_CONFIG));
    bytes[4] = 0xff;
    expect(() => decodeConfig(linkOf(bytes))).toThrow(/people\[0\]\.symbol/);
  });

  it('rejects a bit pattern the format does not use', () => {
    const bytes = bytesOf(encodeConfig(DEFAULT_CONFIG));
    bytes[2] = (bytes[2] as number) | 0x03; // showWeekNumber has three values, not four
    expect(() => decodeConfig(linkOf(bytes))).toThrow(ConfigError);
  });

  it('rejects a name that is not valid UTF-8', () => {
    const bytes = bytesOf(encodeConfig(DEFAULT_CONFIG));
    bytes[6] = 0xff;
    expect(() => decodeConfig(linkOf(bytes))).toThrow(ConfigError);
  });

  it('validates what it unpacks, rather than trusting the bytes', () => {
    const bytes = bytesOf(encodeConfig(resolveConfig({ weekStarting: '2026-09-07' })));
    bytes[3] = (bytes[3] as number) | 0x1f; // 32 weeks, past the limit of 25
    let issues: readonly { path: string }[] = [];
    try {
      decodeConfig(linkOf(bytes));
    } catch (error) {
      issues = error instanceof ConfigError ? error.issues : [];
    }
    expect(issues.map((issue) => issue.path)).toEqual(['weeks']);
  });

  it('opens an older undated link that asked for several copies', () => {
    // Those bits are the number of weeks now, and an undated sheet has none to
    // count. The link still opens; it opens as the one page it can print.
    const bytes = bytesOf(encodeConfig(DEFAULT_CONFIG));
    bytes[3] = (bytes[3] as number) | 0x04;
    const config = decodeConfig(linkOf(bytes));
    expect(config.weeks).toBe(1);
    expect(bytesOf(encodeConfig(config))[3]).toBe(bytesOf(encodeConfig(DEFAULT_CONFIG))[3]);
  });
});

describe('the encoded config', () => {
  const cases: Record<string, SheetConfig> = {
    defaults: DEFAULT_CONFIG,
    shared,
    letter: resolveConfig({
      paper: 'Letter',
      marginMm: 5,
      weekStarting: '2026-09-07',
      weeks: 25,
    }),
  };
  it.each(Object.keys(cases))('is stable and reversible for %s', (name) => {
    const config = cases[name] as SheetConfig;
    const encoded = encodeConfig(config);
    expect(encodeConfig(decodeConfig(encoded))).toBe(encoded);
  });
});
