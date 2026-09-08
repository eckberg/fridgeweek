import type { PaperSize, SheetConfig } from './config.js';
import { type Mark, type ResolvedSheet, resolveSheet } from './resolve.js';

// ---------------------------------------------------------------------------
// Constants. All lengths are millimetres unless the name says otherwise.
// ---------------------------------------------------------------------------

export const PAPER: Record<PaperSize, { width: number; height: number; css: string }> = {
  A4: { width: 210, height: 297, css: 'A4 portrait' },
  Letter: { width: 215.9, height: 279.4, css: 'letter portrait' },
};

/** Below this a line cannot be written on with a normal pen. Error. */
export const MIN_LINE_H = 6;
/** Below this the sheet is usable but cramped. Warning. */
export const COMFORT_LINE_H = 8;
/** The writing rule after the marker strip must be at least this wide. */
export const MIN_WRITE_W = 100;

export const HEADER_H = 15;
export const HEADER_GAP = 4;
/** Space above the weekday name, inside the day block. */
export const DAY_PAD_TOP = 1.8;
/** Space below the last writing line, at the foot of the day block. */
export const DAY_PAD_BOTTOM = 1.4;
/** Height of the weekday name band as a fraction of the day height. */
export const HEAD_RATIO = 0.26;
/** Floor and ceiling for the weekday name band. */
export const HEAD_MIN = 6;
export const HEAD_MAX = 9.5;
/** Left inset of the marker strip inside the content box. */
export const STRIP_INSET = 1;
/** Gutter between the end of the marker strip and the start of the writing rule. */
export const STRIP_GAP = 4.5;
/** Height of a mark as a fraction of the line height, before clamping. */
export const MARK_RATIO = 0.55;
export const MARK_GAP = 1.6;
export const MARK_MIN = 3.5;
export const MARK_MAX = 4.6;
/** Gap between the writing rule and the bottom of its line band, for descenders. */
export const RULE_LIFT = 1.2;
export const DATE_FIELD_W = 14;
/** Gap kept between the weekday name and the right-aligned date column. */
export const NAME_DATE_GUTTER = 4;
export const NAME_FONT_MAX = 8;
export const NAME_FONT_MIN = 4.5;
/** Extra space above the weekday name's capitals, inside the day's top padding. */
export const NAME_TOP_GAP = 0.4;
/** How far text drops below its baseline, as a fraction of font size. */
export const DESCENDER = 0.22;
/** Ceiling for the legend symbol; it otherwise matches the strip mark size. */
export const LEGEND_SYMBOL_MAX = MARK_MAX;
export const LEGEND_FONT = 3.4;
export const LEGEND_FONT_MIN = 2.8;
export const LEGEND_ITEM_GAP = 4.6;
export const LEGEND_ROW_H = 6.5;
export const LEGEND_MAX_ROWS = 3;
export const WEEK_LABEL_FONT = 7;
/** Baseline of the header's week line, below the top of the content box. */
export const WEEK_BASELINE = 10.3;
/** The space between the word and the number, at the week label's size. */
export const WEEK_NUMBER_GAP = 2;
/** Width kept for the week number: two digits, printed or a rule to write on. */
export const WEEK_NUMBER_W = 10.5;
/** A blank header field's rule sits this far below the baseline beside it. */
export const HEADER_FIELD_DROP = 0.6;
/** Gutter between the header's fields. */
export const HEADER_ITEM_GAP = 6;
export const DATE_RANGE_W = 44;
export const DATE_FONT = 3.6;

/**
 * Average advance width per character as a fraction of font size, used to
 * estimate text widths without font metrics. Tuned for Atkinson Hyperlegible Next.
 */
export const GLYPH_W = { upperBold: 0.72, mixed: 0.5, digits: 0.6 } as const;
/** Cap height as a fraction of font size. */
export const CAP_H = 0.7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextAnchor {
  x: number;
  baseline: number;
  fontSize: number;
}

export interface Rule {
  x1: number;
  x2: number;
  y: number;
}

export type IssueCode =
  | 'LINE_TOO_SHORT'
  | 'LINE_TIGHT'
  | 'WRITE_AREA_NARROW'
  | 'LEGEND_OVERFLOW'
  | 'NAME_SHRUNK';

export interface LayoutIssue {
  severity: 'error' | 'warning';
  code: IssueCode;
  message: string;
  /** Concrete changes that would resolve the issue, most effective first. */
  remedies: string[];
}

export interface MarkSlot {
  mark: Mark;
  x: number;
  y: number;
  size: number;
}

export interface LineLayout {
  index: number;
  top: number;
  height: number;
  marks: MarkSlot[];
  rule: Rule;
}

export interface DayLayout {
  /** 0 to 6, top to bottom. */
  position: number;
  rect: Rect;
  weekend: boolean;
  name: TextAnchor & { text: string; letterSpacing: number; estimatedWidth: number };
  /** Blank underline for the date, or the anchor for a printed date. */
  dateField:
    | { x: number; y: number; w: number; text: string | undefined; fontSize: number }
    | undefined;
  lines: LineLayout[];
}

export interface LegendItem {
  mark: Mark;
  symbol: Rect;
  text: TextAnchor & { text: string };
  width: number;
}

export interface HeaderLayout {
  rect: Rect;
  /** The lowest the header actually reaches, which is well above `rect`'s foot. */
  inkBottom: number;
  /** The word, and the week number after it when the sheet is dated. */
  weekLabel: (TextAnchor & { text: string }) | undefined;
  /** Rule to write the week number on, when the sheet is not dated. */
  weekNumberField: Rule | undefined;
  dateRange:
    | { x: number; y: number; w: number; text: string | undefined; fontSize: number }
    | undefined;
  legend: { items: LegendItem[]; rows: number; fontSize: number; maxWidth: number } | undefined;
}

export interface Layout {
  paper: { name: PaperSize; width: number; height: number };
  margin: number;
  content: Rect;
  header: HeaderLayout | undefined;
  /** Rule dividing the header from the days, or the top of the day block. */
  topRule: Rule;
  days: DayLayout[];
  metrics: {
    dayHeight: number;
    headHeight: number;
    lineHeight: number;
    markSize: number;
    stripWidth: number;
    writeWidth: number;
  };
  issues: LayoutIssue[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function charCount(s: string): number {
  return Array.from(s).length;
}

/** Rough width of a run of text, used for fitting. Deliberately generous. */
export function estimateTextWidth(
  text: string,
  fontSize: number,
  style: keyof typeof GLYPH_W,
  letterSpacingEm = 0,
): number {
  const n = charCount(text);
  if (n === 0) return 0;
  return n * fontSize * GLYPH_W[style] + Math.max(0, n - 1) * fontSize * letterSpacingEm;
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Computes every coordinate on the sheet from the config. Pure and deterministic.
 * Nothing is shrunk silently: when the configuration does not fit, `issues`
 * contains an error with remedies and the layout is still returned so it can be
 * previewed.
 */
export function computeLayout(config: SheetConfig): Layout {
  return layoutResolved(resolveSheet(config));
}

export function layoutResolved(sheet: ResolvedSheet): Layout {
  const { config } = sheet;
  const paper = PAPER[config.paper];
  const margin = config.marginMm;
  const content: Rect = {
    x: margin,
    y: margin,
    w: paper.width - 2 * margin,
    h: paper.height - 2 * margin,
  };
  const issues: LayoutIssue[] = [];

  const headerTotal = sheet.hasHeader ? HEADER_H + HEADER_GAP : 0;
  const daysTop = content.y + headerTotal;

  const dayHeight = (content.h - headerTotal) / 7;
  const headHeight = headBandHeight(dayHeight, config.linesPerDay);
  const linesArea = dayHeight - headHeight - DAY_PAD_TOP - DAY_PAD_BOTTOM;
  const lineHeight = linesArea / config.linesPerDay;
  const markSize = clamp(lineHeight * MARK_RATIO, MARK_MIN, MARK_MAX);
  const markCount = sheet.marks.length;
  const stripWidth = markCount * markSize + Math.max(0, markCount - 1) * MARK_GAP;
  const ruleStart = content.x + STRIP_INSET + stripWidth + STRIP_GAP;
  const writeWidth = content.x + content.w - ruleStart;

  // The legend shares the mark size with the strips, so the header needs the
  // metrics; the metrics only need to know whether a header exists.
  const header = sheet.hasHeader ? layoutHeader(sheet, content, markSize, issues) : undefined;

  /*
   * The rule divides the header from the days, so it belongs between them
   * rather than on the day block's own edge. `HEADER_H` is a generous band and
   * the header's ink stops well short of it, so a rule at `daysTop` sat about
   * 8 mm below the header and 2 mm above the weekday names: it read as
   * Monday's underline rather than as a divider. It is now halfway between the
   * lowest ink in the header and the top of the first name's capitals. The day
   * block itself does not move, so every day keeps its height.
   */
  const firstNameTop = daysTop + DAY_PAD_TOP + NAME_TOP_GAP;
  const topRule: Rule = {
    x1: content.x,
    x2: content.x + content.w,
    y: header ? (header.inkBottom + firstNameTop) / 2 : daysTop,
  };

  const remedies = lineRemedies(sheet);
  if (lineHeight < MIN_LINE_H) {
    issues.push({
      severity: 'error',
      code: 'LINE_TOO_SHORT',
      message: `Writing lines are ${r3(lineHeight)} mm tall; at least ${MIN_LINE_H} mm is needed.`,
      remedies,
    });
  } else if (lineHeight < COMFORT_LINE_H) {
    issues.push({
      severity: 'warning',
      code: 'LINE_TIGHT',
      message: `Writing lines are ${r3(lineHeight)} mm tall, which is cramped; ${COMFORT_LINE_H} mm is comfortable.`,
      remedies,
    });
  }
  if (writeWidth < MIN_WRITE_W) {
    issues.push({
      severity: 'error',
      code: 'WRITE_AREA_NARROW',
      message: `Only ${r3(writeWidth)} mm is left for writing after the marker strip; at least ${MIN_WRITE_W} mm is needed.`,
      remedies: ['Use fewer people.', 'Turn off the family mark.', 'Use a smaller margin.'],
    });
  }

  let nameShrunk = false;
  const days: DayLayout[] = sheet.order.map((_weekday, position) => {
    const top = daysTop + position * dayHeight;
    const rect: Rect = { x: content.x, y: top, w: content.w, h: dayHeight };
    const text = sheet.dayNames[position] ?? '';

    // Weekday name: shrink until it fits beside the date column, which is
    // right-aligned at the content edge and therefore at the same x every day.
    const nameX = content.x + 0.5;
    const reserved = config.showDayDates ? DATE_FIELD_W + NAME_DATE_GUTTER : 2;
    const maxNameWidth = content.w - 0.5 - reserved;
    const letterSpacing = 0.04;
    let fontSize = Math.min(NAME_FONT_MAX, headHeight * 0.92);
    let width = estimateTextWidth(text, fontSize, 'upperBold', letterSpacing);
    if (width > maxNameWidth) {
      fontSize = Math.max(NAME_FONT_MIN, fontSize * (maxNameWidth / width));
      width = estimateTextWidth(text, fontSize, 'upperBold', letterSpacing);
      nameShrunk = true;
    }
    const baseline = top + DAY_PAD_TOP + NAME_TOP_GAP + CAP_H * fontSize;

    const dateField: DayLayout['dateField'] = config.showDayDates
      ? {
          // Right-aligned at the content edge: one date column for all seven days.
          x: content.x + content.w - DATE_FIELD_W,
          y: baseline + 0.6,
          w: DATE_FIELD_W,
          text: sheet.dates?.days[position] === undefined ? undefined : sheet.dates.days[position],
          fontSize: DATE_FONT,
        }
      : undefined;

    const linesTop = top + headHeight + DAY_PAD_TOP;
    const lines: LineLayout[] = [];
    for (let i = 0; i < config.linesPerDay; i++) {
      const lineTop = linesTop + i * lineHeight;
      const ruleY = lineTop + lineHeight - RULE_LIFT;
      // Marks sit centred in the line band, so every line has the same rhythm.
      const markY = lineTop + (lineHeight - markSize) / 2;
      const marks: MarkSlot[] = sheet.marks.map((mark, j) => ({
        mark,
        x: content.x + STRIP_INSET + j * (markSize + MARK_GAP),
        y: markY,
        size: markSize,
      }));
      lines.push({
        index: i,
        top: lineTop,
        height: lineHeight,
        marks,
        rule: { x1: ruleStart, x2: content.x + content.w, y: ruleY },
      });
    }

    return {
      position,
      rect,
      weekend: sheet.weekend[position] ?? false,
      name: { x: nameX, baseline, fontSize, text, letterSpacing, estimatedWidth: width },
      dateField,
      lines,
    };
  });

  if (nameShrunk) {
    issues.push({
      severity: 'warning',
      code: 'NAME_SHRUNK',
      message: 'A weekday name was too wide and is drawn smaller than the others.',
      remedies: ['Turn off day dates to free up width.', 'Use a smaller margin.'],
    });
  }

  return roundLayout({
    paper: { name: config.paper, width: paper.width, height: paper.height },
    margin,
    content,
    header,
    topRule,
    days,
    metrics: { dayHeight, headHeight, lineHeight, markSize, stripWidth, writeWidth },
    issues,
  });
}

/**
 * Height of the weekday name band. It takes its share of the day, but the
 * writing lines have priority: rather than push them below the comfort height
 * the band gives up its own, and rather than push them below the floor it gives
 * up more, down to `HEAD_MIN`. Rounded down to 3 decimals so that rounding can
 * never steal a hundredth of a millimetre from a line sitting on a threshold.
 */
function headBandHeight(dayHeight: number, linesPerDay: number): number {
  const ideal = clamp(dayHeight * HEAD_RATIO, HEAD_MIN, HEAD_MAX);
  const forLines = dayHeight - DAY_PAD_TOP - DAY_PAD_BOTTOM;
  const comfort = forLines - linesPerDay * COMFORT_LINE_H;
  const floor = forLines - linesPerDay * MIN_LINE_H;
  const cap = comfort >= HEAD_MIN ? comfort : floor;
  return Math.floor(Math.max(HEAD_MIN, Math.min(ideal, cap)) * 1000) / 1000;
}

function lineRemedies(sheet: ResolvedSheet): string[] {
  const { config } = sheet;
  const remedies: string[] = [];
  if (config.linesPerDay > 1) remedies.push('Use fewer lines per day.');
  if (config.marginMm > 5) remedies.push('Use a smaller margin.');
  if (sheet.hasHeader) {
    remedies.push('Hide the legend, week number and date range to remove the header.');
  }
  return remedies;
}

function layoutHeader(
  sheet: ResolvedSheet,
  content: Rect,
  markSize: number,
  issues: LayoutIssue[],
): HeaderLayout {
  const { config } = sheet;
  const rect: Rect = { x: content.x, y: content.y, w: content.w, h: HEADER_H };
  let cursor = content.x;

  const baseline = content.y + WEEK_BASELINE;

  let weekLabel: HeaderLayout['weekLabel'];
  let weekNumberField: HeaderLayout['weekNumberField'];
  if (sheet.showWeekNumber) {
    // The number reads as part of the phrase, so it is the same run of text at
    // the same size rather than a figure in a box of its own. Undated, the
    // space it would take is a rule to write it on, like every other blank
    // field on the sheet. Either way it takes the same width, so the header
    // does not shift when a date is chosen.
    const word = sheet.text.week.toLocaleUpperCase(config.locale);
    const number = sheet.dates === undefined ? undefined : String(sheet.dates.week);
    weekLabel = {
      text: number === undefined ? word : `${word} ${number}`,
      x: cursor,
      baseline,
      fontSize: WEEK_LABEL_FONT,
    };
    cursor += estimateTextWidth(word, WEEK_LABEL_FONT, 'upperBold', 0.04) + WEEK_NUMBER_GAP;
    if (number === undefined) {
      weekNumberField = {
        x1: cursor,
        x2: cursor + WEEK_NUMBER_W,
        y: baseline + HEADER_FIELD_DROP,
      };
    }
    cursor += WEEK_NUMBER_W + HEADER_ITEM_GAP;
  }

  let dateRange: HeaderLayout['dateRange'];
  if (config.showDateRange) {
    dateRange = {
      x: cursor,
      y: baseline + HEADER_FIELD_DROP,
      w: DATE_RANGE_W,
      text: undefined,
      fontSize: DATE_FONT,
    };
    cursor += DATE_RANGE_W + HEADER_ITEM_GAP;
  }

  let legend: HeaderLayout['legend'];
  if (config.showLegend) {
    const maxWidth = content.x + content.w - cursor;
    legend = layoutLegend(sheet, content, maxWidth, markSize, issues);
  }

  const header: HeaderLayout = {
    rect,
    inkBottom: content.y,
    weekLabel,
    weekNumberField,
    dateRange,
    legend,
  };
  return { ...header, inkBottom: headerInkBottom(header) };
}

/**
 * The lowest the header reaches. Measured from what each field reserves rather
 * than from what it happens to draw, so that choosing a date — which turns a
 * blank rule into printed text — does not move anything.
 */
function headerInkBottom(header: HeaderLayout): number {
  let bottom = header.rect.y;
  if (header.weekLabel) {
    bottom = Math.max(bottom, header.weekLabel.baseline + HEADER_FIELD_DROP);
  }
  if (header.dateRange) bottom = Math.max(bottom, header.dateRange.y);
  for (const item of header.legend?.items ?? []) {
    bottom = Math.max(
      bottom,
      item.symbol.y + item.symbol.h,
      item.text.baseline + item.text.fontSize * DESCENDER,
    );
  }
  return bottom;
}

function layoutLegend(
  sheet: ResolvedSheet,
  content: Rect,
  maxWidth: number,
  markSize: number,
  issues: LayoutIssue[],
): NonNullable<HeaderLayout['legend']> {
  const right = content.x + content.w;
  const marks = sheet.marks;
  // One icon size per sheet: the legend symbol is the strip mark.
  const symbolSize = Math.min(markSize, LEGEND_SYMBOL_MAX);

  const measure = (fontSize: number) =>
    marks.map((mark) => symbolSize + 1.5 + estimateTextWidth(mark.label, fontSize, 'mixed'));

  // Try the normal size in one or two rows, then a smaller size, then a
  // third, shorter row. Only after that is it an overflow.
  let fontSize = LEGEND_FONT;
  let rows = packRows(measure(fontSize), maxWidth);
  if (rows.length > 2) {
    fontSize = LEGEND_FONT_MIN;
    rows = packRows(measure(fontSize), maxWidth);
  }
  if (rows.length > LEGEND_MAX_ROWS) {
    issues.push({
      severity: 'warning',
      code: 'LEGEND_OVERFLOW',
      message: 'The legend does not fit in the header and will run into the week fields.',
      remedies: [
        'Use shorter names.',
        'Hide the date range or the week number.',
        'Hide the legend.',
      ],
    });
    rows = [marks.map((_m, i) => i)];
  }

  const widths = measure(fontSize);
  const rowCount = rows.length;
  const rowHeight =
    rowCount === 1 ? LEGEND_ROW_H : Math.min(LEGEND_ROW_H, (HEADER_H - 1) / rowCount);
  const firstBaseline = rowCount === 1 ? content.y + 9.5 : content.y + rowHeight - 0.8;
  const items: LegendItem[] = [];
  rows.forEach((row, rowIndex) => {
    const baseline = firstBaseline + rowIndex * rowHeight;
    const total =
      row.reduce((sum, i) => sum + (widths[i] ?? 0), 0) + (row.length - 1) * LEGEND_ITEM_GAP;
    let x = right - total;
    for (const i of row) {
      const mark = marks[i];
      const width = widths[i] ?? 0;
      if (!mark) continue;
      items.push({
        mark,
        symbol: { x, y: baseline - symbolSize + fontSize * 0.15, w: symbolSize, h: symbolSize },
        text: { x: x + symbolSize + 1.5, baseline, fontSize, text: mark.label },
        width,
      });
      x += width + LEGEND_ITEM_GAP;
    }
  });
  return { items, rows: rowCount, fontSize, maxWidth };
}

/** Greedy first-fit packing of item widths into rows no wider than `maxWidth`. */
function packRows(widths: number[], maxWidth: number): number[][] {
  const rows: number[][] = [];
  let current: number[] = [];
  let used = 0;
  widths.forEach((w, i) => {
    const needed = current.length === 0 ? w : used + LEGEND_ITEM_GAP + w;
    if (current.length > 0 && needed > maxWidth) {
      rows.push(current);
      current = [i];
      used = w;
    } else {
      current.push(i);
      used = needed;
    }
  });
  if (current.length > 0) rows.push(current);
  return rows;
}

/** Rounds every number in the layout to 3 decimals so output is stable. */
function roundLayout<T>(value: T): T {
  if (typeof value === 'number') return r3(value) as T;
  if (Array.isArray(value)) return value.map((v) => roundLayout(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Marks carry the person object; leave it untouched.
      out[k] = k === 'mark' ? v : roundLayout(v);
    }
    return out as T;
  }
  return value;
}
