/**
 * Writes example sheets to examples/out/ so they can be opened and printed.
 * Run with `pnpm sample` from packages/core or the repo root.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeLayout,
  renderSheet,
  renderSvg,
  resolveConfig,
  type SheetConfigInput,
} from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outDir = join(root, 'examples', 'out');
mkdirSync(outDir, { recursive: true });

const family = [
  { name: 'Ava', symbol: 'unicorn' },
  { name: 'Harry', symbol: 'dinosaur' },
  { name: 'Sara', symbol: 'flower' },
  { name: 'Karl', symbol: 'rocket' },
];

const samples: Record<string, SheetConfigInput> = {
  'a4-sv-family': { locale: 'sv-SE', people: family },
  'a4-sv-family-dated': { locale: 'sv-SE', people: family, weekStarting: '2026-09-07' },
  'a4-en-gb-initials': { locale: 'en-GB', people: family, markStyle: 'initial' },
  'letter-en-us-two': { locale: 'en-US', paper: 'Letter', people: family.slice(0, 2) },
  'a4-de-four-lines': { locale: 'de-DE', people: family.slice(0, 3), linesPerDay: 4 },
  'a4-fi-six-people': {
    locale: 'fi-FI',
    people: [...family, { name: 'Mummo', symbol: 'flower' }, { name: 'Vaari', symbol: 'tractor' }],
  },
  'a4-sv-minimal': {
    locale: 'sv-SE',
    people: family.slice(0, 2),
    showLegend: false,
    showDateRange: false,
    showWeekNumber: false,
    familyMark: false,
    linesPerDay: 2,
  },
};

for (const [name, input] of Object.entries(samples)) {
  const config = resolveConfig(input);
  const layout = computeLayout(config);
  const html = renderSheet(config, { title: `Fridgeweek ${name}` });
  writeFileSync(join(outDir, `${name}.html`), html);
  const issues = layout.issues.map((i) => ` [${i.severity}] ${i.code}: ${i.message}`).join('\n');
  console.log(
    `${name}.html  line ${layout.metrics.lineHeight} mm, mark ${layout.metrics.markSize} mm${issues ? `\n${issues}` : ''}`,
  );
}

// The README preview: a plain SVG without embedded fonts so it stays small.
const preview = renderSvg(resolveConfig(samples['a4-sv-family']));
mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'preview.svg'), preview);
console.log('docs/preview.svg');
