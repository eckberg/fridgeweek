/**
 * UTC-only date helpers, week information and week numbering.
 *
 * Everything in this module works in UTC. Local time is never consulted: dates are
 * `YYYY-MM-DD` strings, `Date` values are always UTC midnight, and weekday arithmetic uses
 * `getUTCDay`. That keeps the rendered sheet identical in every timezone.
 */

/** A calendar date in `YYYY-MM-DD` form, interpreted as UTC. */
export type IsoDate = string;

/** 1 = Monday ... 7 = Sunday, the convention used by `Intl.Locale#getWeekInfo`. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Minimal number of days of the new year the first week of that year must contain. */
export type MinimalDays = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeekInfo {
  /** First day of the week, 1 = Monday ... 7 = Sunday. */
  firstDay: Weekday;
  /** CLDR `minDays`: 4 for the ISO 8601 family, 1 nearly everywhere else. */
  minimalDays: MinimalDays;
  /** Days that count as weekend, same 1..7 numbering. */
  weekend: Weekday[];
}

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Monday, one-day weeks, Saturday + Sunday weekend: the CLDR `001` default. */
const DEFAULT_WEEK_INFO: WeekInfo = { firstDay: 1, minimalDays: 1, weekend: [6, 7] };

/**
 * Region table used only by engines without `Intl.Locale#getWeekInfo` / `#weekInfo`.
 * Generated from Node 22 (ICU 78) and pinned by `test/dates.test.ts`; every region not
 * listed here uses {@link DEFAULT_WEEK_INFO}.
 */
const REGION_WEEK_INFO_TABLE: ReadonlyArray<readonly [string, WeekInfo]> = [
  [
    'AG AS BD BR BS BT BU BW BZ CA CO DM DO ET GT GU HK HN ID JM JP JT KE KH KR LA MH MI MM ' +
      'MO MT MX MZ NI NP PA PE PH PK PR PU PY PZ RH SG SV TH TT TW UM US VE VI WK WS ZA ZW',
    { firstDay: 7, minimalDays: 1, weekend: [6, 7] },
  ],
  [
    'AD AT AX BE BG CH CZ DD DE DK EE ES FI FJ FO FR FX GB GF GG GI GP GR HU IE IM IT JE LI ' +
      'LT LU MC MQ NL NO PL RE RU SE SJ SK SM SU UK VA',
    { firstDay: 1, minimalDays: 4, weekend: [6, 7] },
  ],
  ['BH DZ EG IQ JO KW LY OM QA SD SY', { firstDay: 6, minimalDays: 1, weekend: [5, 6] }],
  ['IL NT SA YD YE', { firstDay: 7, minimalDays: 1, weekend: [5, 6] }],
  ['IS PT', { firstDay: 7, minimalDays: 4, weekend: [6, 7] }],
  ['AF', { firstDay: 6, minimalDays: 1, weekend: [4, 5] }],
  ['DJ', { firstDay: 6, minimalDays: 1, weekend: [6, 7] }],
  ['IN', { firstDay: 7, minimalDays: 1, weekend: [7] }],
  ['IR', { firstDay: 6, minimalDays: 1, weekend: [5] }],
  ['MV', { firstDay: 5, minimalDays: 1, weekend: [6, 7] }],
  ['UG', { firstDay: 1, minimalDays: 1, weekend: [7] }],
];

const REGION_WEEK_INFO: ReadonlyMap<string, WeekInfo> = new Map(
  REGION_WEEK_INFO_TABLE.flatMap(([regions, info]) =>
    regions.split(' ').map((region) => [region, info] as const),
  ),
);

function isWeekdayNumber(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

/** Some engines report Sunday as 0; CLDR and this module use 7. */
function normalizeWeekday(value: unknown): Weekday | undefined {
  if (value === 0) return 7;
  return isWeekdayNumber(value) ? value : undefined;
}

function normalizeWeekInfo(raw: unknown): WeekInfo | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const candidate = raw as { firstDay?: unknown; minimalDays?: unknown; weekend?: unknown };
  const firstDay = normalizeWeekday(candidate.firstDay);
  const minimalDays = candidate.minimalDays;
  if (firstDay === undefined || !isWeekdayNumber(minimalDays)) return undefined;
  const weekend = Array.isArray(candidate.weekend)
    ? candidate.weekend
        .map(normalizeWeekday)
        .filter((day): day is Weekday => day !== undefined)
        .sort((a, b) => a - b)
    : [...DEFAULT_WEEK_INFO.weekend];
  return { firstDay, minimalDays, weekend };
}

/** `Intl.Locale`, whose week fields are newer than the ambient TypeScript lib. */
interface WeekInfoCapableLocale {
  region?: string | undefined;
  maximize?: () => WeekInfoCapableLocale;
  getWeekInfo?: () => unknown;
  weekInfo?: unknown;
}

function makeLocale(locale: string): WeekInfoCapableLocale | undefined {
  try {
    return new Intl.Locale(locale) as WeekInfoCapableLocale;
  } catch {
    return undefined;
  }
}

function weekInfoFromIntl(locale: string): WeekInfo | undefined {
  const parsed = makeLocale(locale);
  if (parsed === undefined) return undefined;
  try {
    // V8 exposes a method, WebKit a getter. Try both, in that order.
    const raw = typeof parsed.getWeekInfo === 'function' ? parsed.getWeekInfo() : parsed.weekInfo;
    return normalizeWeekInfo(raw);
  } catch {
    return undefined;
  }
}

/** Best-effort region subtag: explicit if present, otherwise from `maximize()`. */
function regionOf(locale: string): string | undefined {
  const parsed = makeLocale(locale);
  if (parsed === undefined) return undefined;
  try {
    const region = parsed.region ?? parsed.maximize?.().region;
    return region === undefined ? undefined : region.toUpperCase();
  } catch {
    return parsed.region?.toUpperCase();
  }
}

/**
 * Week info from the built-in region table, ignoring `Intl.Locale#getWeekInfo`.
 * Exported so tests can pin the table against a real ICU; production code should call
 * {@link getWeekInfo}, which prefers the engine's own data.
 */
export function weekInfoFallback(locale: string): WeekInfo {
  const region = regionOf(locale);
  const info = region === undefined ? undefined : REGION_WEEK_INFO.get(region);
  const resolved = info ?? DEFAULT_WEEK_INFO;
  return { ...resolved, weekend: [...resolved.weekend] };
}

/**
 * First day, minimal days and weekend days for a locale. Never throws: an unparseable tag
 * yields the Monday / minimalDays 1 default.
 */
export function getWeekInfo(locale: string): WeekInfo {
  return weekInfoFromIntl(locale) ?? weekInfoFallback(locale);
}

/** `true` when the locale numbers its weeks the ISO way, which is what `showWeekNumber: 'auto'` follows. */
export function usesWeekNumbers(info: WeekInfo): boolean {
  return info.minimalDays === 4;
}

/** The seven weekdays in display order, starting at `firstDay`. */
export function weekOrder(firstDay: Weekday): Weekday[] {
  const order: Weekday[] = [];
  for (let i = 0; i < 7; i++) {
    order.push((((firstDay - 1 + i) % 7) + 1) as Weekday);
  }
  return order;
}

export function isWeekend(day: Weekday, info: WeekInfo): boolean {
  return info.weekend.includes(day);
}

/** Parse `YYYY-MM-DD` as UTC midnight. Throws `RangeError` on anything else. */
export function parseIsoDate(s: string): Date {
  if (!ISO_DATE_RE.test(s)) {
    throw new RangeError(`Invalid ISO date: ${JSON.stringify(s)} (expected YYYY-MM-DD)`);
  }
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (year >= 0 && year <= 99) date.setUTCFullYear(year);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid ISO date: ${JSON.stringify(s)} (not a calendar date)`);
  }
  return date;
}

export function toIsoDate(d: Date): IsoDate {
  const year = d.getUTCFullYear();
  if (!Number.isFinite(year)) throw new RangeError('Invalid Date');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${month}-${day}`;
}

/** A new `Date` `n` days after `d`. UTC, so no daylight-saving surprises. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/** Weekday of a date, 1 = Monday ... 7 = Sunday. */
export function weekdayOf(d: Date): Weekday {
  const day = d.getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

function alignDate(d: Date, firstDay: Weekday): Date {
  const back = (weekdayOf(d) - firstDay + 7) % 7;
  return back === 0 ? new Date(d.getTime()) : addDays(d, -back);
}

/** Snap a date back (0..6 days) to the closest preceding `firstDay`. */
export function alignToWeekStart(date: IsoDate, firstDay: Weekday): IsoDate {
  return toIsoDate(alignDate(parseIsoDate(date), firstDay));
}

/** The seven dates of the week containing `weekStarting`, starting at `firstDay`. */
export function weekDates(weekStarting: IsoDate, firstDay: Weekday): IsoDate[] {
  const start = alignDate(parseIsoDate(weekStarting), firstDay);
  const dates: IsoDate[] = [];
  for (let i = 0; i < 7; i++) dates.push(toIsoDate(addDays(start, i)));
  return dates;
}

/** Start of week 1 of the given week-year, under `info`'s rules. */
function startOfWeekYear(year: number, info: WeekInfo): Date {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  if (year >= 0 && year <= 99) jan1.setUTCFullYear(year);
  const weekStart = alignDate(jan1, info.firstDay);
  const daysInNewYear = 7 - Math.round((jan1.getTime() - weekStart.getTime()) / MS_PER_DAY);
  return daysInNewYear >= info.minimalDays ? weekStart : addDays(weekStart, 7);
}

/**
 * CLDR week-of-year: week 1 is the first week with at least `minimalDays` days in the new
 * year, weeks start on `info.firstDay`. With Monday / 4 this is exactly ISO 8601.
 * `year` is the week-year, which differs from the calendar year around New Year.
 */
export function weekNumber(date: Date, info: WeekInfo): { week: number; year: number } {
  const weekStart = alignDate(date, info.firstDay);
  const calendarYear = date.getUTCFullYear();
  let year = calendarYear;
  let firstWeek = startOfWeekYear(calendarYear, info);
  if (weekStart.getTime() >= startOfWeekYear(calendarYear + 1, info).getTime()) {
    year = calendarYear + 1;
    firstWeek = startOfWeekYear(year, info);
  } else if (weekStart.getTime() < firstWeek.getTime()) {
    year = calendarYear - 1;
    firstWeek = startOfWeekYear(year, info);
  }
  const week = Math.round((weekStart.getTime() - firstWeek.getTime()) / (7 * MS_PER_DAY)) + 1;
  return { week, year };
}

/** A UTC Monday, used as the anchor for weekday-name formatting. */
const WEEKDAY_ANCHOR = Date.UTC(2024, 0, 1);

function formatterFor(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    // An unusable tag must not break rendering; English is the documented fallback.
    return new Intl.DateTimeFormat('en', options);
  }
}

/**
 * Locale weekday name, exactly as `Intl` produces it (lower case in most languages).
 * The renderer uppercases with `toLocaleUpperCase(locale)`.
 */
export function weekdayName(locale: string, day: Weekday, form: 'long' | 'short' = 'long'): string {
  const date = new Date(WEEKDAY_ANCHOR + (day - 1) * MS_PER_DAY);
  return formatterFor(locale, { weekday: form, timeZone: 'UTC' }).format(date);
}

/** Weekday names in week order, starting at `firstDay`. */
export function weekdayNames(
  locale: string,
  firstDay: Weekday,
  form: 'long' | 'short' = 'long',
): string[] {
  return weekOrder(firstDay).map((day) => weekdayName(locale, day, form));
}

/** Short day + month for the field after a weekday name: `14/9` in sv, `9/14` in en-US. */
export function formatDayDate(locale: string, d: Date): string {
  return formatterFor(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Header date range, e.g. `14–20 sep.`. Falls back to an en-dash join without `formatRange`. */
export function formatDateRange(locale: string, start: Date, end: Date): string {
  const formatter = formatterFor(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  try {
    return formatter.formatRange(start, end);
  } catch {
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  }
}

export interface WeekDescription {
  /** Week info of the locale; `firstDay` is the locale's, not any override. */
  info: WeekInfo;
  start: IsoDate;
  end: IsoDate;
  days: IsoDate[];
  week: number;
  weekYear: number;
}

/**
 * Everything the renderer needs about one week, in a single call.
 *
 * `weekStartOverride` (from `config.weekStart`) replaces the locale's first day for
 * alignment, ordering and week numbering; `minimalDays` always comes from the locale.
 */
export function describeWeek(
  weekStarting: IsoDate,
  locale: string,
  weekStartOverride?: Weekday,
): WeekDescription {
  const info = getWeekInfo(locale);
  const firstDay = weekStartOverride ?? info.firstDay;
  const start = alignToWeekStart(weekStarting, firstDay);
  const startDate = parseIsoDate(start);
  const days: IsoDate[] = [];
  for (let i = 0; i < 7; i++) days.push(toIsoDate(addDays(startDate, i)));
  const numbering: WeekInfo = { ...info, firstDay };
  const { week, year } = weekNumber(startDate, numbering);
  return { info, start, end: toIsoDate(addDays(startDate, 6)), days, week, weekYear: year };
}
