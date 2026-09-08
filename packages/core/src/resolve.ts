import { type Person, personInitial, type SheetConfig } from './config.js';
import {
  describeWeek,
  getWeekInfo,
  isWeekend,
  usesWeekNumbers,
  type Weekday,
  type WeekInfo,
  weekdayNames,
  weekOrder,
} from './dates.js';
import { t } from './i18n/index.js';
import { FAMILY_SYMBOL, type SymbolId } from './symbols/index.js';

export interface PersonMark {
  kind: 'person';
  personIndex: number;
  person: Person;
  symbol: SymbolId;
  /** Text drawn when `markStyle` is `'initial'`. */
  initial: string;
  /** Text shown in the legend. */
  label: string;
}

export interface FamilyMark {
  kind: 'family';
  personIndex: -1;
  symbol: SymbolId;
  initial: string;
  label: string;
}

export type Mark = PersonMark | FamilyMark;

export interface ResolvedDates {
  start: string;
  end: string;
  /** Seven ISO dates in week order. */
  days: string[];
  week: number;
  weekYear: number;
}

/**
 * Everything the layout and renderer need that is derived from the config
 * but not stored in it: locale data, the day order, the marks, dated week.
 */
export interface ResolvedSheet {
  config: SheetConfig;
  weekInfo: WeekInfo;
  firstDay: Weekday;
  /** Seven weekdays starting at `firstDay`. */
  order: Weekday[];
  /** True for each position in `order` that is a weekend day in the locale. */
  weekend: boolean[];
  /** Weekday names in `order`, uppercased for the locale. */
  dayNames: string[];
  showWeekNumber: boolean;
  hasHeader: boolean;
  marks: Mark[];
  dates: ResolvedDates | undefined;
  text: { week: string; family: string };
}

const WEEK_START_DAY: Record<Exclude<SheetConfig['weekStart'], 'auto'>, Weekday> = {
  monday: 1,
  saturday: 6,
  sunday: 7,
};

export function resolveSheet(config: SheetConfig): ResolvedSheet {
  const { locale } = config;
  const weekInfo = getWeekInfo(locale);
  const firstDay =
    config.weekStart === 'auto' ? weekInfo.firstDay : WEEK_START_DAY[config.weekStart];
  const order = weekOrder(firstDay);
  const weekend = order.map((day) => isWeekend(day, weekInfo));
  const dayNames = weekdayNames(locale, firstDay, 'long').map((name) =>
    name.toLocaleUpperCase(locale),
  );
  const showWeekNumber =
    config.showWeekNumber === 'auto' ? usesWeekNumbers(weekInfo) : config.showWeekNumber;
  const hasHeader = showWeekNumber || config.showDateRange || config.showLegend;

  const marks: Mark[] = config.people.map((person, personIndex) => ({
    kind: 'person',
    personIndex,
    person,
    symbol: person.symbol,
    initial: personInitial(person),
    label: person.name,
  }));
  const familyLabel = t(locale, 'sheet.family');
  if (config.familyMark) {
    // First in every strip, so the mark that can carry any line is the one the
    // eye reaches first and its position never moves as people are added.
    marks.unshift({
      kind: 'family',
      personIndex: -1,
      symbol: FAMILY_SYMBOL,
      initial: Array.from(familyLabel)[0] ?? '*',
      label: familyLabel,
    });
  }

  let dates: ResolvedDates | undefined;
  if (config.weekStarting !== undefined) {
    const described = describeWeek(config.weekStarting, locale, firstDay);
    dates = {
      start: described.start,
      end: described.end,
      days: described.days,
      week: described.week,
      weekYear: described.weekYear,
    };
  }

  return {
    config,
    weekInfo,
    firstDay,
    order,
    weekend,
    dayNames,
    showWeekNumber,
    hasHeader,
    marks,
    dates,
    text: { week: t(locale, 'sheet.week'), family: familyLabel },
  };
}
