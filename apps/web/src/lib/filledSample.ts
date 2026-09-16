import type { Layout, MarkSlot } from '@fridgeweek/core';

/**
 * A sample sheet with a week written on it.
 *
 * The sheet itself is still rendered by `@fridgeweek/core`, untouched: this
 * draws a second, transparent layer over it, in the same millimetre coordinate
 * system, holding what a pen would leave behind. A landing page that shows an
 * empty grid is asking people to imagine the product; showing a filled week is
 * showing it. Nothing here is ever printed.
 */

export interface SampleEntry {
  /** The day's position in the week as printed, 0 (first) to 6. */
  day: number;
  /** Which writing line within that day, counted from the top. */
  line: number;
  /** What is written on the rule. */
  text: string;
  /**
   * Whose marks are circled. A person's name as it appears on the sheet, or
   * `'family'` for the household mark that leads every strip. More than one
   * name draws more than one ring, which is how a sheet says "both of you".
   */
  who: string[];
}

/** Colours are duplicated rather than imported: this draws over a sheet, not on one. */
const INK = '#111111';
const RING = '#a8471b';

/** Height of the writing as a fraction of the line it sits on. */
const HAND_RATIO = 0.72;
/** How far a ring stands off the mark it circles, as a fraction of the mark. */
const RING_PAD = 0.3;

/**
 * The overlay, as a complete `<svg>` sharing the sheet's viewBox. It carries no
 * accessible name and is hidden from assistive technology: the sheet under it
 * already describes itself, and this adds an illustration, not information.
 */
export function renderFilledOverlay(layout: Layout, entries: SampleEntry[]): string {
  const { paper } = layout;
  const parts = entries.flatMap((entry, index) => renderEntry(layout, entry, index));
  if (parts.length === 0) return '';

  return [
    `<svg class="ink" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(paper.width)} ${fmt(paper.height)}" aria-hidden="true" focusable="false">`,
    ...parts,
    '</svg>',
  ].join('');
}

function renderEntry(layout: Layout, entry: SampleEntry, index: number): string[] {
  const day = layout.days[entry.day];
  const line = day?.lines[entry.line];
  if (!line) return [];

  const out: string[] = [];

  let ringIndex = 0;
  for (const slot of line.marks) {
    if (!isWanted(slot, entry.who)) continue;
    out.push(ring(slot, index * 7 + ringIndex));
    ringIndex += 1;
  }

  const fontSize = line.height * HAND_RATIO;
  // On the rule rather than above it, the way a pen sits: the baseline is the
  // rule, lifted just enough that the stroke is not swallowed by it.
  const baseline = line.rule.y - fontSize * 0.14;
  const x = line.rule.x1 + 1.5;
  // A hand does not write level. The tilt is tiny and never the same twice.
  const tilt = (wobble(index * 31 + 3) - 0.5) * 1.4;

  out.push(
    `<text x="${fmt(x)}" y="${fmt(baseline)}" font-size="${fmt(fontSize)}" fill="${INK}" transform="rotate(${fmt(tilt)} ${fmt(x)} ${fmt(baseline)})">${escapeXml(entry.text)}</text>`,
  );
  return out;
}

function isWanted(slot: MarkSlot, who: string[]): boolean {
  if (slot.mark.kind === 'family') return who.includes('family');
  return who.includes(slot.mark.person.name);
}

function ring(slot: MarkSlot, seed: number): string {
  const radius = (slot.size / 2) * (1 + RING_PAD);
  return `<path d="${ringPath(slot.x + slot.size / 2, slot.y + slot.size / 2, radius, seed)}" fill="none" stroke="${RING}" stroke-width="0.42" stroke-linecap="round"/>`;
}

/**
 * A ring drawn the way a ring gets drawn: not quite round, not quite closed,
 * and carried a little past its own start. A perfect ellipse over a printed
 * mark reads as part of the print, which is the one thing it must not do.
 */
function ringPath(cx: number, cy: number, radius: number, seed: number): string {
  const STEPS = 11;
  const start = -0.5 + (wobble(seed) - 0.5) * 1.2;
  const sweep = Math.PI * 2 + 0.5 + wobble(seed + 1) * 0.5;
  // Nearly round, leaning whichever way the hand was going.
  const squash = 0.9 + wobble(seed + 2) * 0.2;

  const points: Array<[number, number]> = [];
  for (let i = 0; i <= STEPS; i++) {
    const angle = start + (sweep * i) / STEPS;
    const r = radius * (0.94 + wobble(seed * 13 + i) * 0.12);
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * squash]);
  }
  return smoothPath(points);
}

/**
 * Catmull-Rom through the points, written out as cubic Béziers, with the ends
 * clamped. A polyline of eleven segments looks like a stop sign.
 */
function smoothPath(points: Array<[number, number]>): string {
  const at = (i: number): [number, number] =>
    points[Math.min(points.length - 1, Math.max(0, i))] as [number, number];

  const first = at(0);
  const parts = [`M${fmt(first[0])} ${fmt(first[1])}`];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(`C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`);
  }
  return parts.join(' ');
}

/**
 * A number in [0, 1) from an integer. Deterministic on purpose: a sheet built
 * twice has to come out byte for byte the same, so the wobble is a function of
 * where it is and not of when it was drawn.
 */
function wobble(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Three decimals, the sheet's own rounding, with no trailing zeroes. */
function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ??
      character,
  );
}
