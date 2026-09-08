/**
 * The link.
 *
 * A sheet has no server behind it, so its whole configuration travels in the
 * URL hash. That makes the encoding part of the product rather than an
 * implementation detail: it is what people paste into a message, and what a
 * mail client decides whether to wrap. So it is packed, not pretty.
 *
 * Two formats can be read; one is written.
 *
 * - **Packed (format 2).** Bytes, base64url. Flags and enums are bits, numbers
 *   are bytes, a symbol is its number from `SYMBOL_CODES` and the date is a day
 *   offset. Only names are text, because only names are unpredictable. A
 *   two-person sheet with a date and a language comes to about 30 characters.
 * - **JSON (format 1).** The original: a base64url JSON object holding the
 *   fields that differ from the defaults. Still read, because links people have
 *   already shared and configurations already in `localStorage` must keep
 *   working. Still written for the one configuration the packed format cannot
 *   hold — a margin that is not a whole tenth of a millimetre — because
 *   rounding it would be the silent guess this project does not make.
 *
 * The two are told apart by the first byte: JSON starts with `{`.
 *
 * Encoding is deterministic: the same configuration always gives the same
 * string.
 */
import {
  ConfigError,
  DEFAULT_CONFIG,
  isRecord,
  LIMITS,
  type PersonInput,
  resolveConfig,
  type SheetConfig,
  WEEK_STARTS,
} from './config.js';
import { parseIsoDate, toIsoDate } from './dates.js';
import { symbolCode, symbolFromCode } from './symbols/codes.js';

const FORMAT_PACKED = 2;
/** `'{'`, the first byte of every format 1 payload. */
const FORMAT_JSON = 0x7b;

// Byte 1: everything that is one bit, because it is a choice between two.
const PAPER_LETTER = 0x01;
/**
 * Read but never written: the sheet-wide mark style, from before a mark became
 * a property of each person. `config.ts` says what it means now.
 */
const MARK_INITIAL = 0x02;
const WEEKEND_PLAIN = 0x04;
const NO_DATE_RANGE = 0x08;
const NO_DAY_DATES = 0x10;
const NO_LEGEND = 0x20;
const NO_FAMILY_MARK = 0x40;
const HAS_WEEK_STARTING = 0x80;

// Byte 2: two three-state fields, one small number, two presence bits.
const WEEK_NUMBER_MASK = 0x03;
const WEEK_START_SHIFT = 2;
const WEEK_START_MASK = 0x03;
const LINES_SHIFT = 4;
const LINES_MASK = 0x03;
const HAS_LOCALE = 0x40;
const HAS_MARGIN = 0x80;

// Byte 3: the two counts.
const COPIES_MASK = 0x1f;
const PEOPLE_SHIFT = 5;
const PEOPLE_MASK = 0x07;

/** `showWeekNumber` by code. `'auto'` first, so the default packs as zero. */
const WEEK_NUMBER_VALUES = ['auto', true, false] as const;

/** Day zero of a packed `weekStarting`. Two bytes then reach the year 2179. */
const DATE_EPOCH = Date.UTC(2000, 0, 1);
const MS_PER_DAY = 86_400_000;
const MAX_DATE_OFFSET = 0xffff;

/** A margin packs as tenths of a millimetre above the smallest one allowed. */
const MARGIN_SCALE = 10;
const MARGIN_BASE = LIMITS.marginMm.min * MARGIN_SCALE;

/**
 * A name's length byte carries the flag for a following initial in its top bit.
 * That bit is also what says this person is drawn as their initials.
 */
const HAS_INITIAL = 0x80;
const MAX_TEXT_BYTES = 0x7f;

const UTF8_ENCODER = new TextEncoder();
/** Strict, so that a mangled link is reported rather than read as `'�'`. */
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export function encodeConfig(config: SheetConfig): string {
  return base64UrlEncode(packConfig(config) ?? UTF8_ENCODER.encode(encodeJson(config)));
}

export function decodeConfig(encoded: string): SheetConfig {
  const bytes = base64UrlDecode(encoded);
  if (bytes === undefined || bytes.length === 0) throw brokenLink();
  if (bytes[0] === FORMAT_JSON) return decodeJson(bytes);
  if (bytes[0] === FORMAT_PACKED) return unpackConfig(bytes);
  throw new ConfigError([{ path: 'v', message: 'unsupported encoded config version' }]);
}

function brokenLink(): ConfigError {
  return new ConfigError([{ path: '', message: 'not a valid encoded config' }]);
}

// ---------------------------------------------------------------------------
// Format 2: packed bytes
// ---------------------------------------------------------------------------

/**
 * Packs a configuration, or returns `undefined` when it holds a value the
 * format cannot express and the JSON form has to carry it instead.
 */
function packConfig(config: SheetConfig): Uint8Array | undefined {
  const weekNumber = WEEK_NUMBER_VALUES.indexOf(config.showWeekNumber);
  const weekStart = WEEK_STARTS.indexOf(config.weekStart);
  if (weekNumber < 0 || weekStart < 0) return undefined;
  if (!isCount(config.linesPerDay, LINES_MASK)) return undefined;
  if (!isCount(config.copies, COPIES_MASK)) return undefined;
  if (!isCount(config.people.length, PEOPLE_MASK)) return undefined;

  const hasMargin = config.marginMm !== DEFAULT_CONFIG.marginMm;
  let margin = 0;
  if (hasMargin) {
    const packed = packMargin(config.marginMm);
    if (packed === undefined) return undefined;
    margin = packed;
  }

  let day = 0;
  if (config.weekStarting !== undefined) {
    const packed = packDate(config.weekStarting);
    if (packed === undefined) return undefined;
    day = packed;
  }

  const locale =
    config.locale === DEFAULT_CONFIG.locale ? undefined : UTF8_ENCODER.encode(config.locale);
  if (locale !== undefined && (locale.length === 0 || locale.length > 0xff)) return undefined;

  let flags = 0;
  if (config.paper === 'Letter') flags |= PAPER_LETTER;
  if (config.weekendStyle === 'plain') flags |= WEEKEND_PLAIN;
  if (!config.showDateRange) flags |= NO_DATE_RANGE;
  if (!config.showDayDates) flags |= NO_DAY_DATES;
  if (!config.showLegend) flags |= NO_LEGEND;
  if (!config.familyMark) flags |= NO_FAMILY_MARK;
  if (config.weekStarting !== undefined) flags |= HAS_WEEK_STARTING;

  let fields = weekNumber | (weekStart << WEEK_START_SHIFT);
  fields |= (config.linesPerDay - 1) << LINES_SHIFT;
  if (locale !== undefined) fields |= HAS_LOCALE;
  if (hasMargin) fields |= HAS_MARGIN;

  const counts = (config.copies - 1) | ((config.people.length - 1) << PEOPLE_SHIFT);

  const bytes = [FORMAT_PACKED, flags, fields, counts];
  if (hasMargin) bytes.push(margin);
  if (config.weekStarting !== undefined) bytes.push(day >>> 8, day & 0xff);
  if (locale !== undefined) bytes.push(locale.length, ...locale);

  for (const person of config.people) {
    const code = symbolCode(person.symbol);
    if (code === undefined || code > 0xff) return undefined;
    const name = UTF8_ENCODER.encode(person.name);
    if (name.length === 0 || name.length > MAX_TEXT_BYTES) return undefined;
    const initial = person.initial === undefined ? undefined : UTF8_ENCODER.encode(person.initial);
    if (initial !== undefined && (initial.length === 0 || initial.length > MAX_TEXT_BYTES)) {
      return undefined;
    }
    bytes.push(code, name.length | (initial === undefined ? 0 : HAS_INITIAL), ...name);
    if (initial !== undefined) bytes.push(initial.length, ...initial);
  }

  return Uint8Array.from(bytes);
}

function unpackConfig(bytes: Uint8Array): SheetConfig {
  let at = 1;
  const byte = (): number => {
    const value = bytes[at];
    if (value === undefined) throw brokenLink();
    at += 1;
    return value;
  };
  const text = (length: number): string => {
    if (at + length > bytes.length) throw brokenLink();
    const slice = bytes.subarray(at, at + length);
    at += length;
    try {
      return UTF8_DECODER.decode(slice);
    } catch {
      throw brokenLink();
    }
  };

  const flags = byte();
  const fields = byte();
  const counts = byte();

  const input: Record<string, unknown> = {};
  if ((flags & PAPER_LETTER) !== 0) input.paper = 'Letter';
  if ((flags & MARK_INITIAL) !== 0) input.markStyle = 'initial';
  if ((flags & WEEKEND_PLAIN) !== 0) input.weekendStyle = 'plain';
  if ((flags & NO_DATE_RANGE) !== 0) input.showDateRange = false;
  if ((flags & NO_DAY_DATES) !== 0) input.showDayDates = false;
  if ((flags & NO_LEGEND) !== 0) input.showLegend = false;
  if ((flags & NO_FAMILY_MARK) !== 0) input.familyMark = false;

  const weekNumber = WEEK_NUMBER_VALUES[fields & WEEK_NUMBER_MASK];
  if (weekNumber === undefined) throw brokenLink();
  input.showWeekNumber = weekNumber;
  const weekStart = WEEK_STARTS[(fields >>> WEEK_START_SHIFT) & WEEK_START_MASK];
  if (weekStart === undefined) throw brokenLink();
  input.weekStart = weekStart;
  input.linesPerDay = ((fields >>> LINES_SHIFT) & LINES_MASK) + 1;
  input.copies = (counts & COPIES_MASK) + 1;

  if ((fields & HAS_MARGIN) !== 0) input.marginMm = unpackMargin(byte());
  if ((flags & HAS_WEEK_STARTING) !== 0) {
    const high = byte();
    input.weekStarting = unpackDate((high << 8) | byte());
  }
  if ((fields & HAS_LOCALE) !== 0) input.locale = text(byte());

  const people: PersonInput[] = [];
  const count = ((counts >>> PEOPLE_SHIFT) & PEOPLE_MASK) + 1;
  for (let i = 0; i < count; i += 1) {
    const code = byte();
    const symbol = symbolFromCode(code);
    if (symbol === undefined) {
      throw new ConfigError([
        { path: `people[${i}].symbol`, message: `unknown symbol code: ${code}` },
      ]);
    }
    const length = byte();
    const person: PersonInput = { name: text(length & MAX_TEXT_BYTES), symbol };
    if ((length & HAS_INITIAL) !== 0) person.initial = text(byte());
    people.push(person);
  }
  input.people = people;

  if (at !== bytes.length) throw brokenLink();
  return resolveConfig(input);
}

/** Tenths of a millimetre above the smallest margin, or `undefined` if it is not a tenth. */
function packMargin(mm: number): number | undefined {
  const packed = Math.round(mm * MARGIN_SCALE) - MARGIN_BASE;
  if (!Number.isInteger(packed) || packed < 0 || packed > 0xff) return undefined;
  return unpackMargin(packed) === mm ? packed : undefined;
}

function unpackMargin(packed: number): number {
  return (packed + MARGIN_BASE) / MARGIN_SCALE;
}

/** Days since {@link DATE_EPOCH}, or `undefined` for a date two bytes cannot reach. */
function packDate(iso: string): number | undefined {
  let time: number;
  try {
    time = parseIsoDate(iso).getTime();
  } catch {
    return undefined;
  }
  const days = (time - DATE_EPOCH) / MS_PER_DAY;
  if (!Number.isInteger(days) || days < 0 || days > MAX_DATE_OFFSET) return undefined;
  return days;
}

function unpackDate(days: number): string {
  return toIsoDate(new Date(DATE_EPOCH + days * MS_PER_DAY));
}

/** True for a count from 1 to `mask + 1`, which is what its bits can hold. */
function isCount(value: number, mask: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= mask + 1;
}

// ---------------------------------------------------------------------------
// Format 1: base64url JSON, still read and used as the fallback
// ---------------------------------------------------------------------------

type PersonTuple = [name: string, symbol: string] | [name: string, symbol: string, initial: string];

interface EncodedConfig {
  v: 1;
  p: PersonTuple[];
  [key: string]: unknown;
}

const DIFF_KEYS = [
  'locale',
  'paper',
  'marginMm',
  'weekStart',
  'showWeekNumber',
  'showDateRange',
  'showDayDates',
  'showLegend',
  'weekStarting',
  'familyMark',
  'linesPerDay',
  'weekendStyle',
  'copies',
] as const;

function encodeJson(config: SheetConfig): string {
  const payload: EncodedConfig = {
    v: 1,
    p: config.people.map((person) =>
      person.initial === undefined
        ? [person.name, person.symbol]
        : [person.name, person.symbol, person.initial],
    ),
  };
  for (const key of DIFF_KEYS) {
    const value = config[key];
    if (value !== undefined && value !== DEFAULT_CONFIG[key]) {
      payload[key] = value;
    }
  }
  return JSON.stringify(payload);
}

function decodeJson(bytes: Uint8Array): SheetConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(UTF8_DECODER.decode(bytes));
  } catch {
    throw brokenLink();
  }
  if (!isRecord(parsed) || parsed.v !== 1) {
    throw new ConfigError([{ path: 'v', message: 'unsupported encoded config version' }]);
  }
  const { v: _v, p, ...rest } = parsed;
  const input: Record<string, unknown> = { ...rest };
  if (p !== undefined) {
    if (!Array.isArray(p)) {
      throw new ConfigError([{ path: 'p', message: 'people must be an array' }]);
    }
    input.people = p.map((tuple: unknown) => {
      if (!Array.isArray(tuple)) return tuple;
      const person: PersonInput = { name: tuple[0], symbol: tuple[1] };
      if (tuple[2] !== undefined) person.initial = tuple[2];
      return person;
    });
  }
  return resolveConfig(input);
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): Uint8Array | undefined {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
}
