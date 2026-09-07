/**
 * Loads the compiled package the way npm consumers will, in plain Node with no
 * bundler. This catches the class of mistake a bundler hides: a JSON import
 * missing its attribute, a missing extension, a stray Node-only global.
 *
 * Run after `pnpm build`.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { publishConfig } = require('../package.json');
const entry = new URL(`../${publishConfig.exports['.'].import.replace('./', '')}`, import.meta.url);

const core = await import(entry.href);

const required = [
  'resolveConfig',
  'computeLayout',
  'renderSvg',
  'renderSheet',
  'encodeConfig',
  'decodeConfig',
  'symbolLabel',
  'SHEET_LOCALES',
  'SYMBOL_IDS',
  't',
  'fontFaceCss',
];

const missing = required.filter((name) => core[name] === undefined);
if (missing.length > 0) {
  throw new Error(`The published entry point is missing: ${missing.join(', ')}`);
}

// Exercise the whole pipeline once, so a broken import surfaces as a failure
// rather than as a module that loads but cannot do anything.
const config = core.resolveConfig({ locale: 'sv-SE', weekStarting: '2026-09-07' });
const svg = core.renderSvg(config);
if (!svg.includes('MÅNDAG')) throw new Error('The rendered sheet is not in the requested locale.');
if (core.symbolLabel('house') !== 'House') throw new Error('Symbol names did not load.');
if (core.t('sv', 'sheet.week') !== 'Vecka') throw new Error('Sheet translations did not load.');
if (!core.fontFaceCss().includes('data:font/woff2')) throw new Error('Fonts did not load.');

console.log(
  `dist loads in plain Node: ${core.SYMBOL_IDS.length} symbols, ${svg.length} byte sheet`,
);
