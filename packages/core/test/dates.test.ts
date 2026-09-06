import { describe, expect, it } from 'vitest';
import {
  addDays,
  alignToWeekStart,
  describeWeek,
  formatDateRange,
  formatDayDate,
  getWeekInfo,
  isWeekend,
  type MinimalDays,
  parseIsoDate,
  toIsoDate,
  usesWeekNumbers,
  type Weekday,
  type WeekInfo,
  weekDates,
  weekdayName,
  weekdayNames,
  weekdayOf,
  weekInfoFallback,
  weekNumber,
  weekOrder,
} from '../src/dates.js';

const MS_PER_DAY = 86_400_000;

function info(firstDay: Weekday, minimalDays: MinimalDays): WeekInfo {
  return { firstDay, minimalDays, weekend: [6, 7] };
}

const ISO = info(1, 4);
const US = info(7, 1);

function week(date: string, rules: WeekInfo): string {
  const { week: w, year } = weekNumber(parseIsoDate(date), rules);
  return `${w}/${year}`;
}

/**
 * Deliberately naive second implementation, used to cross-check `weekNumber`.
 * It counts the days of a candidate week that fall in the year one by one instead of
 * doing the offset arithmetic of the real implementation.
 */
function referenceWeekNumber(date: string, rules: WeekInfo): string {
  const day = (t: number): Weekday => {
    const d = new Date(t).getUTCDay();
    return (d === 0 ? 7 : d) as Weekday;
  };
  const firstWeekStart = (year: number): number => {
    const jan1 = Date.UTC(year, 0, 1);
    let start = jan1;
    while (day(start) !== rules.firstDay) start -= MS_PER_DAY;
    let inYear = 0;
    for (let i = 0; i < 7; i++) {
      if (new Date(start + i * MS_PER_DAY).getUTCFullYear() === year) inYear++;
    }
    return inYear >= rules.minimalDays ? start : start + 7 * MS_PER_DAY;
  };
  const t = parseIsoDate(date).getTime();
  const calendarYear = new Date(t).getUTCFullYear();
  for (const year of [calendarYear + 1, calendarYear, calendarYear - 1]) {
    const start = firstWeekStart(year);
    if (t >= start) {
      return `${Math.floor((t - start) / (7 * MS_PER_DAY)) + 1}/${year}`;
    }
  }
  throw new Error(`unreachable for ${date}`);
}

describe('parseIsoDate / toIsoDate', () => {
  it('parses a valid date as UTC midnight', () => {
    const d = parseIsoDate('2026-09-14');
    expect(d.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it.each([
    '2024-02-30',
    '2024-1-5',
    '20240105',
    'abc',
    '',
    '2024-13-01',
    '2024-00-10',
    '2024-09-31',
  ])('rejects %o', (bad) => {
    expect(() => parseIsoDate(bad)).toThrow(RangeError);
  });

  it('accepts leap days and rejects non-leap 29 February', () => {
    expect(toIsoDate(parseIsoDate('2024-02-29'))).toBe('2024-02-29');
    expect(() => parseIsoDate('2023-02-29')).toThrow(RangeError);
  });

  it('round-trips a year of dates', () => {
    let d = parseIsoDate('2026-01-01');
    for (let i = 0; i < 400; i++) {
      const iso = toIsoDate(d);
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(toIsoDate(parseIsoDate(iso))).toBe(iso);
      d = addDays(d, 1);
    }
  });
});

describe('addDays / weekdayOf', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(toIsoDate(addDays(parseIsoDate('2026-12-31'), 1))).toBe('2027-01-01');
    expect(toIsoDate(addDays(parseIsoDate('2024-02-28'), 1))).toBe('2024-02-29');
    expect(toIsoDate(addDays(parseIsoDate('2026-09-14'), -14))).toBe('2026-08-31');
  });

  it('maps Sunday to 7', () => {
    expect(weekdayOf(parseIsoDate('2024-01-01'))).toBe(1);
    expect(weekdayOf(parseIsoDate('2026-09-06'))).toBe(7);
    expect(weekdayOf(parseIsoDate('2026-09-12'))).toBe(6);
  });
});

describe('weekOrder / isWeekend / usesWeekNumbers', () => {
  it('starts at firstDay and wraps', () => {
    expect(weekOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(weekOrder(6)).toEqual([6, 7, 1, 2, 3, 4, 5]);
  });

  it('reads the weekend from the locale info', () => {
    expect(isWeekend(6, ISO)).toBe(true);
    expect(isWeekend(5, ISO)).toBe(false);
    const friSat: WeekInfo = { firstDay: 6, minimalDays: 1, weekend: [5, 6] };
    expect(isWeekend(5, friSat)).toBe(true);
    expect(isWeekend(7, friSat)).toBe(false);
  });

  it('uses week numbers exactly for the ISO family', () => {
    expect(usesWeekNumbers(ISO)).toBe(true);
    expect(usesWeekNumbers(US)).toBe(false);
    expect(usesWeekNumbers(getWeekInfo('sv-SE'))).toBe(true);
    expect(usesWeekNumbers(getWeekInfo('en-US'))).toBe(false);
  });
});

describe('alignToWeekStart / weekDates', () => {
  it('snaps back to the previous first day', () => {
    // 2026-09-09 is a Wednesday.
    expect(alignToWeekStart('2026-09-09', 1)).toBe('2026-09-07');
    expect(alignToWeekStart('2026-09-09', 7)).toBe('2026-09-06');
    expect(alignToWeekStart('2026-09-09', 6)).toBe('2026-09-05');
  });

  it('leaves a date that is already the first day alone', () => {
    expect(alignToWeekStart('2026-09-07', 1)).toBe('2026-09-07');
    expect(alignToWeekStart('2026-09-06', 7)).toBe('2026-09-06');
    expect(alignToWeekStart('2026-09-05', 6)).toBe('2026-09-05');
  });

  it('never moves a date more than six days back', () => {
    let d = parseIsoDate('2026-01-01');
    for (let i = 0; i < 400; i++) {
      for (const firstDay of [1, 6, 7] as const) {
        const aligned = parseIsoDate(alignToWeekStart(toIsoDate(d), firstDay));
        const back = (d.getTime() - aligned.getTime()) / MS_PER_DAY;
        expect(back).toBeGreaterThanOrEqual(0);
        expect(back).toBeLessThan(7);
        expect(weekdayOf(aligned)).toBe(firstDay);
      }
      d = addDays(d, 1);
    }
  });

  it('returns seven consecutive dates from the aligned start', () => {
    expect(weekDates('2026-09-09', 1)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
    expect(weekDates('2026-09-09', 7)[0]).toBe('2026-09-06');
    expect(weekDates('2026-12-30', 1)).toHaveLength(7);
    expect(weekDates('2026-12-30', 1).at(-1)).toBe('2027-01-03');
  });
});

describe('weekNumber, ISO 8601 rules (firstDay 1, minimalDays 4)', () => {
  it.each([
    ['2021-01-03', '53/2020'],
    ['2021-01-04', '1/2021'],
    ['2024-12-30', '1/2025'],
    ['2026-09-06', '36/2026'],
    ['2020-12-31', '53/2020'],
    ['2010-01-03', '53/2009'],
    ['2027-01-01', '53/2026'],
    ['2026-09-09', '37/2026'],
    ['2000-01-01', '52/1999'],
    ['2016-02-29', '9/2016'],
  ])('%s is week %s', (date, expected) => {
    expect(week(date, ISO)).toBe(expected);
  });
});

describe('weekNumber, US rules (firstDay 7, minimalDays 1)', () => {
  it.each([
    ['2021-01-01', '1/2021'],
    ['2021-01-02', '1/2021'],
    ['2021-01-03', '2/2021'],
    // The week of 27 Dec 2020 already contains 1 Jan 2021, and with minimalDays = 1 that
    // makes it week 1 of week-year 2021 -- the same forward roll-over the ISO rules apply
    // to 2024-12-30. Cross-checked against java.time WeekFields.of(SUNDAY, 1).
    ['2020-12-31', '1/2021'],
    ['2026-09-06', '37/2026'],
    ['2016-02-29', '10/2016'],
  ])('%s is week %s', (date, expected) => {
    expect(week(date, US)).toBe(expected);
    expect(referenceWeekNumber(date, US)).toBe(expected);
  });

  it('agrees with the independent reference implementation', () => {
    const configs: WeekInfo[] = [
      info(1, 4),
      info(7, 1),
      info(6, 1),
      info(1, 1),
      info(5, 1),
      info(7, 4),
      info(3, 7),
    ];
    let d = parseIsoDate('1998-01-01');
    for (let i = 0; i < 4000; i++) {
      const iso = toIsoDate(d);
      for (const rules of configs) {
        expect(week(iso, rules), `${iso} ${rules.firstDay}/${rules.minimalDays}`).toBe(
          referenceWeekNumber(iso, rules),
        );
      }
      d = addDays(d, 1);
    }
  });

  it('numbers weeks 1..53 and increments by one within a week-year', () => {
    for (const rules of [ISO, US]) {
      let previous = weekNumber(parseIsoDate('2019-01-07'), rules);
      let d = parseIsoDate('2019-01-14');
      for (let i = 0; i < 400; i++) {
        const current = weekNumber(d, rules);
        expect(current.week).toBeGreaterThanOrEqual(1);
        expect(current.week).toBeLessThanOrEqual(53);
        if (current.year === previous.year) {
          expect(current.week).toBe(previous.week + 1);
        } else {
          expect(current.year).toBe(previous.year + 1);
          expect(current.week).toBe(1);
        }
        previous = current;
        d = addDays(d, 7);
      }
    }
  });
});

describe('getWeekInfo', () => {
  it('knows the ISO locales', () => {
    expect(getWeekInfo('sv-SE')).toEqual({ firstDay: 1, minimalDays: 4, weekend: [6, 7] });
    expect(getWeekInfo('en-GB')).toEqual({ firstDay: 1, minimalDays: 4, weekend: [6, 7] });
    expect(getWeekInfo('de-DE')).toEqual({ firstDay: 1, minimalDays: 4, weekend: [6, 7] });
  });

  it('knows the Sunday-first locales', () => {
    expect(getWeekInfo('en-US')).toEqual({ firstDay: 7, minimalDays: 1, weekend: [6, 7] });
    expect(getWeekInfo('ja-JP').firstDay).toBe(7);
    expect(getWeekInfo('pt-BR').firstDay).toBe(7);
  });

  it('knows a Saturday-first locale with a Friday weekend', () => {
    const eg = getWeekInfo('ar-EG');
    expect(eg.firstDay).toBe(6);
    expect(eg.weekend).toEqual([5, 6]);
    // ar-SA moved to Sunday-first in CLDR; it keeps the Friday/Saturday weekend.
    expect(getWeekInfo('ar-SA').weekend).toEqual([5, 6]);
  });

  it('resolves a language-only tag through its likely region', () => {
    expect(getWeekInfo('sv').firstDay).toBe(1);
    expect(getWeekInfo('en').firstDay).toBe(7);
  });

  it.each(['not a locale', '', '!!', 'en-US-', '@@@'])(
    'never throws on the invalid tag %o',
    (bad) => {
      expect(() => getWeekInfo(bad)).not.toThrow();
      expect(getWeekInfo(bad)).toEqual({ firstDay: 1, minimalDays: 1, weekend: [6, 7] });
    },
  );

  it('returns a fresh object each call', () => {
    const first = getWeekInfo('sv-SE');
    first.weekend.push(1);
    expect(getWeekInfo('sv-SE').weekend).toEqual([6, 7]);
    const fallback = weekInfoFallback('sv-SE');
    fallback.weekend.push(1);
    expect(weekInfoFallback('sv-SE').weekend).toEqual([6, 7]);
  });
});

describe('weekInfoFallback', () => {
  // Pins the built-in region table against the engine's own CLDR data. The table only
  // exists for engines without Intl.Locale#getWeekInfo / #weekInfo.
  const locales = [
    'sv-SE',
    'nb-NO',
    'da-DK',
    'fi-FI',
    'de-DE',
    'de-AT',
    'de-CH',
    'fr-FR',
    'nl-NL',
    'it-IT',
    'es-ES',
    'pl-PL',
    'ru-RU',
    'en-GB',
    'en-IE',
    'is-IS',
    'pt-PT',
    'pt-BR',
    'en-US',
    'en-CA',
    'es-MX',
    'ja-JP',
    'ko-KR',
    'zh-TW',
    'zh-HK',
    'en-SG',
    'en-ZA',
    'he-IL',
    'hi-IN',
    'ar-EG',
    'ar-SA',
    'ar-AE',
    'fa-IR',
    'en-AU',
    'en-NZ',
    'tr-TR',
    'cs-CZ',
    'el-GR',
    'th-TH',
    'id-ID',
    'sv',
    'de',
    'en',
  ];

  const engineHasWeekInfo = (() => {
    const locale = new Intl.Locale('en-US') as {
      getWeekInfo?: () => unknown;
      weekInfo?: unknown;
    };
    return typeof locale.getWeekInfo === 'function' || locale.weekInfo !== undefined;
  })();

  it.runIf(engineHasWeekInfo).each(locales)('matches Intl for %s', (locale) => {
    expect(weekInfoFallback(locale)).toEqual(getWeekInfo(locale));
  });
});

describe('weekdayName / weekdayNames', () => {
  it('formats the name in the locale, as Intl produces it', () => {
    expect(weekdayName('sv-SE', 1)).toBe('måndag');
    expect(weekdayName('en-US', 7)).toBe('Sunday');
    expect(weekdayName('de-DE', 4)).toBe('Donnerstag');
    expect(weekdayName('fi-FI', 3)).toBe('keskiviikko');
    expect(weekdayName('en-GB', 6)).toBe('Saturday');
  });

  it('supports the short form', () => {
    expect(weekdayName('en-US', 1, 'short')).toBe('Mon');
    expect(weekdayName('en-US', 1, 'long')).toBe('Monday');
  });

  it('falls back to English for an unusable tag instead of throwing', () => {
    expect(weekdayName('not a locale', 1)).toBe('Monday');
  });

  it('returns the names in week order', () => {
    expect(weekdayNames('en-US', 1, 'short')).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(weekdayNames('en-US', 7, 'short')[0]).toBe('Sun');
    expect(weekdayNames('sv-SE', 1)[0]).toBe('måndag');
    expect(weekdayNames('sv-SE', 1)).toHaveLength(7);
    expect(new Set(weekdayNames('de-DE', 1)).size).toBe(7);
  });
});

describe('formatDayDate / formatDateRange', () => {
  const day = parseIsoDate('2026-09-14');

  it('orders day and month per locale', () => {
    expect(formatDayDate('sv-SE', day)).toBe('14/9');
    expect(formatDayDate('en-US', day)).toBe('9/14');
    // ICU versions disagree about the zero padding, only the order is guaranteed.
    expect(formatDayDate('en-GB', day)).toMatch(/^14\/0?9\.?$/);
    expect(formatDayDate('de-DE', day)).toContain('14.9');
  });

  it('formats a range containing both day numbers', () => {
    const end = parseIsoDate('2026-09-20');
    for (const locale of ['sv-SE', 'en-US', 'en-GB', 'de-DE']) {
      const range = formatDateRange(locale, day, end);
      expect(range.length).toBeGreaterThan(0);
      expect(range).toContain('14');
      expect(range).toContain('20');
    }
  });

  it('formats a range that crosses a month', () => {
    const range = formatDateRange('sv-SE', parseIsoDate('2026-09-28'), parseIsoDate('2026-10-04'));
    expect(range).toContain('28');
    expect(range).toContain('4');
  });

  it('does not throw on an unusable tag', () => {
    expect(() => formatDayDate('not a locale', day)).not.toThrow();
    expect(() => formatDateRange('not a locale', day, day)).not.toThrow();
  });
});

describe('describeWeek', () => {
  it('describes a Swedish week', () => {
    expect(describeWeek('2026-09-09', 'sv-SE')).toEqual({
      info: { firstDay: 1, minimalDays: 4, weekend: [6, 7] },
      start: '2026-09-07',
      end: '2026-09-13',
      days: [
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
        '2026-09-12',
        '2026-09-13',
      ],
      week: 37,
      weekYear: 2026,
    });
  });

  it('describes an American week, which starts on Sunday', () => {
    const described = describeWeek('2026-09-09', 'en-US');
    expect(described.start).toBe('2026-09-06');
    expect(described.end).toBe('2026-09-12');
    expect(described.days).toHaveLength(7);
    expect(described.week).toBe(37);
  });

  it('honours a week-start override but keeps the locale minimalDays', () => {
    const described = describeWeek('2026-09-09', 'sv-SE', 7);
    expect(described.info.firstDay).toBe(1); // the locale's own value is preserved
    expect(described.start).toBe('2026-09-06');
    expect(described.end).toBe('2026-09-12');
    // Sunday-start weeks with the ISO minimalDays of 4: 6 Sep is still week 36.
    expect(described.week).toBe(36);
    expect(describeWeek('2026-09-09', 'en-US', 1).start).toBe('2026-09-07');
  });

  it('is stable when the given date already is the week start', () => {
    expect(describeWeek('2026-09-07', 'sv-SE').start).toBe('2026-09-07');
  });

  it('reports the week-year across New Year', () => {
    const described = describeWeek('2027-01-01', 'sv-SE');
    expect(described.start).toBe('2026-12-28');
    expect(described.week).toBe(53);
    expect(described.weekYear).toBe(2026);
  });

  it('throws on an invalid date', () => {
    expect(() => describeWeek('2026-02-30', 'sv-SE')).toThrow(RangeError);
  });
});
