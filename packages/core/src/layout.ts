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

export const HEADER_H = 14;
export const HEADER_GAP = 3;
export const DAY_PAD_TOP = 1;
export const DAY_PAD_BOTTOM = 1;
export const MARK_GAP = 1.6;
export const MARK_MIN = 3.5;
export const MARK_MAX = 5.5;
export const DATE_FIELD_W = 14;
export const NAME_FONT_MAX = 8;
export const NAME_FONT_MIN = 4.5;
export const LEGEND_SYMBOL = 5;
export const LEGEND_FONT = 3.4;
export const LEGEND_FONT_MIN = 2.8;
export const LEGEND_ITEM_GAP = 5;
export const LEGEND_ROW_H = 6.5;
export const LEGEND_MAX_ROWS = 3;
export const WEEK_LABEL_FONT = 7;
export const WEEK_BOX = { w: 18, h: 11 };
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
  /** Separator drawn at the bottom of this day, absent for the last day. */
  separator: Rule | undefined;
}

export interface LegendItem {
  mark: Mark;
  symbol: Rect;
  text: TextAnchor & { text: string };
  width: number;
}

export interface HeaderLayout {
  rect: Rect;
  weekLabel: (TextAnchor & { text: string }) | undefined;
  weekBox: (Rect & { text: string | undefined }) | undefined;
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
  /** Rule at the top of the day block. */
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

  const header = sheet.hasHeader ? layoutHeader(sheet, content, issues) : undefined;
  const headerTotal = header ? HEADER_H + HEADER_GAP : 0;
  const daysTop = content.y + headerTotal;
  const topRule: Rule = { x1: content.x, x2: content.x + content.w, y: daysTop };

  const dayHeight = (content.h - headerTotal) / 7;
  const headHeight = clamp(dayHeight * 0.22, 6, 9);
  const linesArea = dayHeight - headHeight - DAY_PAD_TOP - DAY_PAD_BOTTOM;
  const lineHeight = linesArea / config.linesPerDay;
  const markSize = clamp(lineHeight * 0.62, MARK_MIN, MARK_MAX);
  const markCount = sheet.marks.length;
  const stripWidth = markCount * markSize + Math.max(0, markCount - 1) * MARK_GAP;
  const ruleStart = content.x + 1 + stripWidth + 2.5;
  const writeWidth = content.x + content.w - ruleStart;

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

    // Weekday name: shrink until it fits beside the date field.
    const nameX = content.x + 0.5;
    const reserved = config.showDayDates ? DATE_FIELD_W + 4 + 2 : 2;
    const maxNameWidth = content.w - 0.5 - reserved;
    const letterSpacing = 0.04;
    let fontSize = Math.min(NAME_FONT_MAX, headHeight * 0.92);
    let width = estimateTextWidth(text, fontSize, 'upperBold', letterSpacing);
    if (width > maxNameWidth) {
      fontSize = Math.max(NAME_FONT_MIN, fontSize * (maxNameWidth / width));
      width = estimateTextWidth(text, fontSize, 'upperBold', letterSpacing);
      nameShrunk = true;
    }
    const baseline = top + DAY_PAD_TOP + 0.4 + CAP_H * fontSize;

    const dateField: DayLayout['dateField'] = config.showDayDates
      ? {
          x: nameX + width + 4,
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
      const ruleY = lineTop + lineHeight - 0.6;
      const marks: MarkSlot[] = sheet.marks.map((mark, j) => ({
        mark,
        x: content.x + 1 + j * (markSize + MARK_GAP),
        y: ruleY - 0.7 - markSize,
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

    const separator: Rule | undefined =
      position < 6 ? { x1: content.x, x2: content.x + content.w, y: top + dayHeight } : undefined;

    return {
      position,
      rect,
      weekend: sheet.weekend[position] ?? false,
      name: { x: nameX, baseline, fontSize, text, letterSpacing, estimatedWidth: width },
      dateField,
      lines,
      separator,
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

function layoutHeader(sheet: ResolvedSheet, content: Rect, issues: LayoutIssue[]): HeaderLayout {
  const { config } = sheet;
  const rect: Rect = { x: content.x, y: content.y, w: content.w, h: HEADER_H };
  let cursor = content.x;

  let weekLabel: HeaderLayout['weekLabel'];
  let weekBox: HeaderLayout['weekBox'];
  if (sheet.showWeekNumber) {
    const text = sheet.text.week.toLocaleUpperCase(config.locale);
    const width = estimateTextWidth(text, WEEK_LABEL_FONT, 'upperBold', 0.04);
    weekLabel = {
      text,
      x: cursor,
      baseline: content.y + 1.5 + WEEK_BOX.h - 2.2,
      fontSize: WEEK_LABEL_FONT,
    };
    cursor += width + 3;
    weekBox = {
      x: cursor,
      y: content.y + 1.5,
      w: WEEK_BOX.w,
      h: WEEK_BOX.h,
      text: sheet.dates ? String(sheet.dates.week) : undefined,
    };
    cursor += WEEK_BOX.w + 6;
  }

  let dateRange: HeaderLayout['dateRange'];
  if (config.showDateRange) {
    dateRange = {
      x: cursor,
      y: content.y + 1.5 + WEEK_BOX.h - 1.6,
      w: DATE_RANGE_W,
      text: undefined,
      fontSize: DATE_FONT,
    };
    cursor += DATE_RANGE_W + 6;
  }

  let legend: HeaderLayout['legend'];
  if (config.showLegend) {
    const maxWidth = content.x + content.w - cursor;
    legend = layoutLegend(sheet, content, maxWidth, issues);
  }

  return { rect, weekLabel, weekBox, dateRange, legend };
}

function layoutLegend(
  sheet: ResolvedSheet,
  content: Rect,
  maxWidth: number,
  issues: LayoutIssue[],
): NonNullable<HeaderLayout['legend']> {
  const right = content.x + content.w;
  const marks = sheet.marks;

  const measure = (fontSize: number) =>
    marks.map((mark) => LEGEND_SYMBOL + 1.5 + estimateTextWidth(mark.label, fontSize, 'mixed'));

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
  const symbolSize = Math.min(LEGEND_SYMBOL, rowHeight - 1.2);
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
        text: { x: x + LEGEND_SYMBOL + 1.5, baseline, fontSize, text: mark.label },
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
