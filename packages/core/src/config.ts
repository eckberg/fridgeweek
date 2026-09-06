import { parseIsoDate } from './dates.js';
import { isSymbolId, type SymbolId } from './symbols/index.js';

export type PaperSize = 'A4' | 'Letter';
export type MarkStyle = 'symbol' | 'initial';
export type WeekStart = 'auto' | 'monday' | 'sunday' | 'saturday';
export type WeekendStyle = 'outline' | 'plain';

export interface Person {
  /** Shown in the legend. 1 to 24 characters. */
  name: string;
  /** Symbol used as this person's mark when `markStyle` is `'symbol'`. */
  symbol: SymbolId;
  /** 1 to 2 characters used when `markStyle` is `'initial'`. Defaults to the first character of `name`. */
  initial?: string;
}

export interface SheetConfig {
  version: 1;
  /** BCP 47 language tag, e.g. `'sv-SE'`. Drives weekday names, date formats and week rules. */
  locale: string;
  paper: PaperSize;
  /** Page margin in millimetres, 5 to 20. */
  marginMm: number;
  weekStart: WeekStart;
  /** `'auto'` shows the week number for locales that count weeks the ISO way. */
  showWeekNumber: 'auto' | boolean;
  showDateRange: boolean;
  showDayDates: boolean;
  showLegend: boolean;
  /** `'YYYY-MM-DD'`. When set, the week number, date range and day dates are printed. */
  weekStarting?: string;
  /** 1 to 6 people. */
  people: Person[];
  markStyle: MarkStyle;
  /** Adds a household mark (a house) at the end of every marker strip. */
  familyMark: boolean;
  /** Writing lines per day, 1 to 4. */
  linesPerDay: number;
  weekendStyle: WeekendStyle;
  /** Identical pages in the printed document, 1 to 20. */
  copies: number;
}

/** Loosely typed input accepted by {@link resolveConfig}. Missing fields take defaults. */
export interface PersonInput {
  name?: string;
  symbol?: string;
  initial?: string;
}

export type SheetConfigInput = {
  [K in keyof Omit<SheetConfig, 'people' | 'version'>]?: SheetConfig[K];
} & {
  version?: 1;
  people?: PersonInput[];
};

export const LIMITS = {
  people: { min: 1, max: 6 },
  linesPerDay: { min: 1, max: 4 },
  marginMm: { min: 5, max: 20 },
  copies: { min: 1, max: 20 },
  nameLength: { min: 1, max: 24 },
  initialLength: { min: 1, max: 2 },
} as const;

export const PAPER_SIZES: readonly PaperSize[] = ['A4', 'Letter'];
export const MARK_STYLES: readonly MarkStyle[] = ['symbol', 'initial'];
export const WEEK_STARTS: readonly WeekStart[] = ['auto', 'monday', 'sunday', 'saturday'];
export const WEEKEND_STYLES: readonly WeekendStyle[] = ['outline', 'plain'];

export const DEFAULT_PEOPLE: readonly Person[] = [
  { name: 'Alex', symbol: 'cat' },
  { name: 'Sam', symbol: 'rocket' },
];

export const DEFAULT_CONFIG: SheetConfig = Object.freeze({
  version: 1,
  locale: 'en',
  paper: 'A4',
  marginMm: 10,
  weekStart: 'auto',
  showWeekNumber: 'auto',
  showDateRange: true,
  showDayDates: true,
  showLegend: true,
  people: DEFAULT_PEOPLE.map((p) => ({ ...p })),
  markStyle: 'symbol',
  familyMark: true,
  linesPerDay: 3,
  weekendStyle: 'outline',
  copies: 1,
}) as SheetConfig;

export interface ConfigIssue {
  /** Dot path into the config, e.g. `people[2].symbol`. */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; config: SheetConfig }
  | { ok: false; issues: ConfigIssue[] };

export class ConfigError extends Error {
  readonly issues: ConfigIssue[];
  constructor(issues: ConfigIssue[]) {
    super(`Invalid sheet config: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

const KNOWN_KEYS = new Set<string>(Object.keys(DEFAULT_CONFIG).concat('weekStarting'));

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isPlainInteger(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x);
}

function charCount(s: string): number {
  return Array.from(s).length;
}

/**
 * Applies defaults and validates. Never guesses: every problem is reported with a path.
 */
export function validateConfig(input: unknown): ValidationResult {
  const issues: ConfigIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: '', message: 'config must be an object' }] };
  }

  for (const key of Object.keys(input)) {
    if (!KNOWN_KEYS.has(key)) {
      issues.push({ path: key, message: 'unknown field' });
    }
  }

  const out: SheetConfig = { ...DEFAULT_CONFIG, people: [] };

  if (input.version !== undefined && input.version !== 1) {
    issues.push({ path: 'version', message: 'unsupported version, expected 1' });
  }

  if (input.locale !== undefined) {
    if (typeof input.locale !== 'string' || input.locale.length === 0) {
      issues.push({ path: 'locale', message: 'must be a non-empty BCP 47 tag' });
    } else {
      try {
        // Canonicalisation throws on structurally invalid tags.
        out.locale = new Intl.Locale(input.locale).toString();
      } catch {
        issues.push({ path: 'locale', message: `not a valid BCP 47 tag: ${input.locale}` });
      }
    }
  }

  checkEnum(input, 'paper', PAPER_SIZES, issues, (v) => {
    out.paper = v;
  });
  checkEnum(input, 'weekStart', WEEK_STARTS, issues, (v) => {
    out.weekStart = v;
  });
  checkEnum(input, 'markStyle', MARK_STYLES, issues, (v) => {
    out.markStyle = v;
  });
  checkEnum(input, 'weekendStyle', WEEKEND_STYLES, issues, (v) => {
    out.weekendStyle = v;
  });

  checkNumber(input, 'marginMm', LIMITS.marginMm, false, issues, (v) => {
    out.marginMm = v;
  });
  checkNumber(input, 'linesPerDay', LIMITS.linesPerDay, true, issues, (v) => {
    out.linesPerDay = v;
  });
  checkNumber(input, 'copies', LIMITS.copies, true, issues, (v) => {
    out.copies = v;
  });

  if (input.showWeekNumber !== undefined) {
    if (input.showWeekNumber === 'auto' || typeof input.showWeekNumber === 'boolean') {
      out.showWeekNumber = input.showWeekNumber;
    } else {
      issues.push({ path: 'showWeekNumber', message: "must be 'auto', true or false" });
    }
  }
  for (const key of ['showDateRange', 'showDayDates', 'showLegend', 'familyMark'] as const) {
    const v = input[key];
    if (v !== undefined) {
      if (typeof v === 'boolean') {
        out[key] = v;
      } else {
        issues.push({ path: key, message: 'must be true or false' });
      }
    }
  }

  if (input.weekStarting !== undefined) {
    if (typeof input.weekStarting !== 'string') {
      issues.push({ path: 'weekStarting', message: 'must be a YYYY-MM-DD string' });
    } else {
      try {
        parseIsoDate(input.weekStarting);
        out.weekStarting = input.weekStarting;
      } catch {
        issues.push({ path: 'weekStarting', message: `not a valid date: ${input.weekStarting}` });
      }
    }
  }

  const people = input.people === undefined ? DEFAULT_PEOPLE : input.people;
  if (!Array.isArray(people)) {
    issues.push({ path: 'people', message: 'must be an array' });
  } else {
    if (people.length < LIMITS.people.min || people.length > LIMITS.people.max) {
      issues.push({
        path: 'people',
        message: `must have ${LIMITS.people.min} to ${LIMITS.people.max} entries`,
      });
    }
    people.forEach((raw, i) => {
      const person = validatePerson(raw, `people[${i}]`, issues);
      if (person) out.people.push(person);
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, config: out };
}

function validatePerson(raw: unknown, path: string, issues: ConfigIssue[]): Person | undefined {
  if (!isRecord(raw)) {
    issues.push({ path, message: 'must be an object' });
    return undefined;
  }
  let ok = true;
  const name = raw.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    issues.push({ path: `${path}.name`, message: 'must be a non-empty string' });
    ok = false;
  } else if (charCount(name) > LIMITS.nameLength.max) {
    issues.push({
      path: `${path}.name`,
      message: `must be at most ${LIMITS.nameLength.max} characters`,
    });
    ok = false;
  }
  const symbol = raw.symbol;
  if (!isSymbolId(symbol)) {
    issues.push({ path: `${path}.symbol`, message: `unknown symbol: ${String(symbol)}` });
    ok = false;
  }
  let initial: string | undefined;
  if (raw.initial !== undefined) {
    if (typeof raw.initial !== 'string') {
      issues.push({ path: `${path}.initial`, message: 'must be a string' });
      ok = false;
    } else {
      const len = charCount(raw.initial);
      if (len < LIMITS.initialLength.min || len > LIMITS.initialLength.max) {
        issues.push({
          path: `${path}.initial`,
          message: `must be ${LIMITS.initialLength.min} to ${LIMITS.initialLength.max} characters`,
        });
        ok = false;
      } else {
        initial = raw.initial;
      }
    }
  }
  for (const key of Object.keys(raw)) {
    if (key !== 'name' && key !== 'symbol' && key !== 'initial') {
      issues.push({ path: `${path}.${key}`, message: 'unknown field' });
      ok = false;
    }
  }
  if (!ok || !isSymbolId(symbol) || typeof name !== 'string') return undefined;
  const person: Person = { name: name.trim(), symbol };
  if (initial !== undefined) person.initial = initial;
  return person;
}

function checkEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  issues: ConfigIssue[],
  set: (v: T) => void,
): void {
  const v = input[key];
  if (v === undefined) return;
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) {
    set(v as T);
  } else {
    issues.push({ path: key, message: `must be one of ${allowed.join(', ')}` });
  }
}

function checkNumber(
  input: Record<string, unknown>,
  key: string,
  range: { min: number; max: number },
  integer: boolean,
  issues: ConfigIssue[],
  set: (v: number) => void,
): void {
  const v = input[key];
  if (v === undefined) return;
  const valid = integer ? isPlainInteger(v) : typeof v === 'number' && Number.isFinite(v);
  if (!valid || (v as number) < range.min || (v as number) > range.max) {
    issues.push({
      path: key,
      message: `must be ${integer ? 'an integer' : 'a number'} between ${range.min} and ${range.max}`,
    });
    return;
  }
  set(v as number);
}

/** Applies defaults and validates; throws {@link ConfigError} on any problem. */
export function resolveConfig(input: unknown = {}): SheetConfig {
  const result = validateConfig(input);
  if (!result.ok) throw new ConfigError(result.issues);
  return result.config;
}

/** The initial shown for a person: explicit `initial`, else the first character of the name. */
export function personInitial(person: Person): string {
  if (person.initial !== undefined) return person.initial;
  const first = Array.from(person.name.trim())[0];
  return first ?? '?';
}

// ---------------------------------------------------------------------------
// URL encoding
//
// The config travels in the URL hash as a base64url-encoded JSON object holding
// only the fields that differ from the defaults, plus the people list in a
// compact tuple form. `v` is the format version.
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
  'markStyle',
  'familyMark',
  'linesPerDay',
  'weekendStyle',
  'copies',
] as const;

export function encodeConfig(config: SheetConfig): string {
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
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeConfig(encoded: string): SheetConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encoded));
  } catch {
    throw new ConfigError([{ path: '', message: 'not a valid encoded config' }]);
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

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): string {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
