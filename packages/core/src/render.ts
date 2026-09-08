import { resolveConfig, type SheetConfig } from './config.js';
import { formatDateRange, formatDayDate, parseIsoDate } from './dates.js';
import { FONT_STACK, fontFaceCss } from './fonts/index.js';
import {
  type DayLayout,
  type HeaderLayout,
  type Layout,
  type LineLayout,
  layoutResolved,
  PAPER,
  type Rule,
} from './layout.js';
import { type Mark, type ResolvedSheet, resolveSheet } from './resolve.js';
import { type SymbolId, symbolToSvgSymbol } from './symbols/index.js';

export interface RenderOptions {
  /**
   * Prefix for element ids inside the SVG, so several sheets can share one
   * HTML document without id collisions. Default `'fw'`.
   */
  idPrefix?: string;
  /** Embed the typeface as `@font-face` inside the SVG itself. Default false. */
  embedFonts?: boolean;
  /** Document title for {@link renderSheet}. Default `'Fridgeweek'`. */
  title?: string;
}

export const INK = '#111111';
export const RULE = '#c8c8c8';
export const GHOST = '#8f8f8f';

/** Renders one sheet as a standalone SVG whose user unit is the millimetre. */
export function renderSvg(config: SheetConfig, options: RenderOptions = {}): string {
  const sheet = resolveSheet(config);
  return renderSvgResolved(sheet, layoutResolved(sheet), options);
}

/**
 * Renders a complete, self-contained HTML document with `copies` pages,
 * embedded fonts and print CSS. This is what gets previewed, printed and
 * turned into a PDF.
 */
export function renderSheet(config: SheetConfig, options: RenderOptions = {}): string {
  const sheet = resolveSheet(config);
  const layout = layoutResolved(sheet);
  const paper = PAPER[config.paper];
  const pages: string[] = [];
  for (let i = 0; i < config.copies; i++) {
    const svg = renderSvgResolved(sheet, layout, {
      ...options,
      idPrefix: `p${i + 1}`,
      embedFonts: false,
    });
    pages.push(`<div class="page">${svg}</div>`);
  }
  const title = escapeXml(options.title ?? 'Fridgeweek');
  const size = `${fmt(paper.width)}mm ${fmt(paper.height)}mm`;
  return [
    '<!doctype html>',
    `<html lang="${escapeXml(config.locale)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>',
    `@page { size: ${size}; margin: 0; }`,
    fontFaceCss(),
    'html, body { margin: 0; padding: 0; background: #fff; }',
    `.page { width: ${fmt(paper.width)}mm; height: ${fmt(paper.height)}mm; overflow: hidden; break-after: page; page-break-after: always; }`,
    '.page:last-child { break-after: auto; page-break-after: auto; }',
    '.page > svg { display: block; width: 100%; height: 100%; }',
    '@media screen { body { background: #e9e7e2; padding: 8mm 0; } .page { margin: 0 auto 8mm; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.18); } }',
    '@media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }',
    '</style>',
    '</head>',
    '<body>',
    ...pages,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/** Convenience: validate loose input and render the HTML document in one call. */
export function renderSheetFromInput(input: unknown, options?: RenderOptions): string {
  return renderSheet(resolveConfig(input), options);
}

// ---------------------------------------------------------------------------

function renderSvgResolved(sheet: ResolvedSheet, layout: Layout, options: RenderOptions): string {
  const prefix = options.idPrefix ?? 'fw';
  const { paper } = layout;

  const symbolIds = new Set<SymbolId>();
  for (const mark of sheet.marks) {
    if (mark.style === 'symbol') symbolIds.add(mark.symbol);
  }
  const defs = Array.from(symbolIds)
    .sort()
    .map((id) => symbolToSvgSymbol(id, `${prefix}-s-${id}`))
    .join('');

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${fmt(paper.width)} ${fmt(paper.height)}" width="${fmt(paper.width)}mm" height="${fmt(paper.height)}mm" font-family="${escapeXml(FONT_STACK)}" fill="${INK}" role="img" aria-label="${escapeXml(ariaLabel(sheet))}">`,
  );
  if (options.embedFonts) {
    parts.push(`<style>${fontFaceCss()}</style>`);
  }
  parts.push(`<defs>${defs}</defs>`);
  parts.push(
    `<rect x="0" y="0" width="${fmt(paper.width)}" height="${fmt(paper.height)}" fill="#fff"/>`,
  );

  if (layout.header) parts.push(renderHeader(sheet, layout.header, prefix));
  parts.push(rule(layout.topRule, INK, 0.5));
  for (const day of layout.days) parts.push(renderDay(sheet, day, prefix));

  parts.push('</svg>');
  return parts.join('');
}

function renderHeader(sheet: ResolvedSheet, header: HeaderLayout, prefix: string): string {
  const { config } = sheet;
  const out: string[] = ['<g class="header">'];

  if (header.weekLabel) {
    out.push(
      text(header.weekLabel.text, header.weekLabel.x, header.weekLabel.baseline, {
        fontSize: header.weekLabel.fontSize,
        weight: 800,
        letterSpacing: 0.04,
      }),
    );
  }
  if (header.weekNumberField) {
    out.push(rule(header.weekNumberField, RULE, 0.3));
  }
  if (header.dateRange) {
    const d = header.dateRange;
    if (sheet.dates) {
      const label = formatDateRange(
        config.locale,
        parseIsoDate(sheet.dates.start),
        parseIsoDate(sheet.dates.end),
      );
      out.push(text(label, d.x, d.y - 0.8, { fontSize: d.fontSize, weight: 400 }));
    } else {
      out.push(rule({ x1: d.x, x2: d.x + d.w, y: d.y }, RULE, 0.3));
    }
  }
  if (header.legend) {
    out.push('<g class="legend">');
    for (const item of header.legend.items) {
      out.push(renderMark(item.mark, item.symbol.x, item.symbol.y, item.symbol.w, prefix, INK));
      out.push(
        text(item.text.text, item.text.x, item.text.baseline, {
          fontSize: item.text.fontSize,
          weight: 400,
        }),
      );
    }
    out.push('</g>');
  }
  out.push('</g>');
  return out.join('');
}

function renderDay(sheet: ResolvedSheet, day: DayLayout, prefix: string): string {
  const { config } = sheet;
  const out: string[] = [`<g class="day" data-position="${day.position}">`];

  const outline = day.weekend && config.weekendStyle === 'outline';
  out.push(
    text(day.name.text, day.name.x, day.name.baseline, {
      fontSize: day.name.fontSize,
      weight: 800,
      letterSpacing: day.name.letterSpacing,
      outline,
    }),
  );

  if (day.dateField) {
    const f = day.dateField;
    if (f.text !== undefined) {
      const label = formatDayDate(config.locale, parseIsoDate(f.text));
      // The field is right-aligned at the content edge, so the text is too.
      out.push(
        text(label, f.x + f.w, f.y - 0.9, {
          fontSize: f.fontSize,
          weight: 400,
          anchor: 'end',
          fill: '#444444',
        }),
      );
    } else {
      out.push(rule({ x1: f.x, x2: f.x + f.w, y: f.y }, RULE, 0.3));
    }
  }

  for (const line of day.lines) out.push(renderLine(line, prefix));

  out.push('</g>');
  return out.join('');
}

function renderLine(line: LineLayout, prefix: string): string {
  const out: string[] = [`<g class="line" data-index="${line.index}">`];
  for (const slot of line.marks) {
    out.push(renderMark(slot.mark, slot.x, slot.y, slot.size, prefix, GHOST));
  }
  out.push(rule(line.rule, RULE, 0.3));
  out.push('</g>');
  return out.join('');
}

function renderMark(
  mark: Mark,
  x: number,
  y: number,
  size: number,
  prefix: string,
  color: string,
): string {
  if (mark.style === 'symbol') {
    return `<use href="#${prefix}-s-${mark.symbol}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" color="${color}"/>`;
  }
  const fontSize = size * 0.92;
  const baseline = y + size / 2 + 0.7 * fontSize * 0.5;
  return text(mark.initial, x + size / 2, baseline, {
    fontSize,
    weight: 700,
    anchor: 'middle',
    fill: color,
  });
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

interface TextStyle {
  fontSize: number;
  weight: 400 | 700 | 800;
  letterSpacing?: number;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  outline?: boolean;
}

function text(content: string, x: number, baseline: number, style: TextStyle): string {
  const attrs: string[] = [
    `x="${fmt(x)}"`,
    `y="${fmt(baseline)}"`,
    `font-size="${fmt(style.fontSize)}"`,
    `font-weight="${style.weight}"`,
  ];
  if (style.letterSpacing)
    attrs.push(`letter-spacing="${fmt(style.letterSpacing * style.fontSize)}"`);
  if (style.anchor && style.anchor !== 'start') attrs.push(`text-anchor="${style.anchor}"`);
  if (style.outline) {
    attrs.push(`fill="none" stroke="${INK}" stroke-width="0.35" stroke-linejoin="round"`);
  } else if (style.fill) {
    attrs.push(`fill="${style.fill}"`);
  }
  return `<text ${attrs.join(' ')}>${escapeXml(content)}</text>`;
}

function rule(r: Rule, stroke: string, width: number): string {
  return `<line x1="${fmt(r.x1)}" y1="${fmt(r.y)}" x2="${fmt(r.x2)}" y2="${fmt(r.y)}" stroke="${stroke}" stroke-width="${fmt(width)}"/>`;
}

function ariaLabel(sheet: ResolvedSheet): string {
  const names = sheet.config.people.map((p) => p.name).join(', ');
  return sheet.dates
    ? `Week ${sheet.dates.week}, ${sheet.dates.start} to ${sheet.dates.end}: ${names}`
    : `Weekly sheet: ${names}`;
}

export function fmt(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
