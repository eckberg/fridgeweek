# @fridgeweek/core

The engine behind [Fridgeweek](https://github.com/eckberg/fridgeweek): a printable weekly
sheet for the fridge, one week, seven days top to bottom, filled in by hand.

Everything is a pure function of one config object. Give it a `SheetConfig` and it gives you
back every coordinate in millimetres, or a finished SVG page, or a self-contained HTML
document ready to print. No runtime dependencies, no DOM access, no network: it runs the
same in Node, in a browser and in a Cloudflare Worker.

Not published to npm yet. Inside this repository it is a workspace package that resolves to
its TypeScript source.

## Usage

```ts
import { writeFileSync } from 'node:fs';
import { renderSheet, resolveConfig } from '@fridgeweek/core';

const config = resolveConfig({
  locale: 'sv-SE',
  paper: 'A4',
  people: [
    { name: 'Alma', symbol: 'cat' },
    { name: 'Nils', symbol: 'rocket' },
  ],
});

writeFileSync('sheet.html', renderSheet(config));
```

Open `sheet.html` in a browser and print it. `renderSvg` gives you the single page instead,
if you want to embed it.

## The height budget

The hard part is not the look, it is fitting seven equal days on one page. `computeLayout`
solves it and reports what it found rather than shrinking anything silently:

```ts
const layout = computeLayout(config);
layout.metrics; // { dayHeight, headHeight, lineHeight, markSize, stripWidth, writeWidth }
layout.issues;  // [{ severity, code, message, remedies }]
```

A writing line below 6 mm cannot be written on with a normal pen, so that is an `error` with
a list of remedies, most effective first. Below 8 mm is a `warning`. On A4 with a 10 mm
margin, three lines a day come out at 8.052 mm and four at 6.039 mm. Callers are expected to
show the issues; `renderSvg` will still draw a sheet that does not fit, because deciding what
to do about it belongs to the interface.

Output is deterministic. It depends only on the config, carries no timestamps and no
randomness, and every number is rounded to three decimals, which is what makes the snapshot
tests meaningful.

## Exports

```ts
// config
resolveConfig(input: unknown): SheetConfig     // applies defaults, validates, throws ConfigError
validateConfig(input: unknown): ValidationResult
DEFAULT_CONFIG: SheetConfig
encodeConfig(config: SheetConfig): string      // base64url, versioned
decodeConfig(encoded: string): SheetConfig     // throws ConfigError

// layout
computeLayout(config: SheetConfig): Layout     // every coordinate in mm, plus issues[]

// rendering
renderSvg(config: SheetConfig, options?: RenderOptions): string
renderSheet(config: SheetConfig, options?: RenderOptions): string  // standalone HTML

// symbols
SYMBOL_IDS: readonly SymbolId[]
getSymbol(id: SymbolId): SymbolDef             // { id, body, source, labels }
isSymbolId(x: unknown): x is SymbolId
FAMILY_SYMBOL: SymbolId                        // 'house'

// fonts
FONT_FAMILY, FONT_STACK
fontFaceCss(): string                          // @font-face rules with data: URIs

// dates
getWeekInfo(locale): WeekInfo                  // { firstDay, minimalDays, weekend }
weekOrder(firstDay): Weekday[]
weekdayName(locale, weekday, form): string
weekNumber(date, weekInfo): { week, year }
alignToWeekStart(date, firstDay): IsoDate
formatDayDate(locale, date): string
formatDateRange(locale, start, end): string
addDays, parseIsoDate, toIsoDate               // UTC-only helpers

// i18n
t(locale, key): string                         // the sheet's own words, falls back to en
SHEET_LOCALES                                  // the languages the picker offers
```

The config model, the layout constants and the reasoning behind both are in
[DESIGN.md](https://github.com/eckberg/fridgeweek/blob/main/DESIGN.md).

## Notes

Fonts and icons are embedded, not fetched: `renderSheet` inlines the Atkinson Hyperlegible
Next WOFF2 files as `data:` URIs, so a sheet previews, prints and converts to PDF
identically everywhere and works offline.

`pnpm generate` regenerates the icon and font modules from `lucide-static` and the files in
`assets/`. Run it after changing the curated symbol list; the generated modules are
committed.

MIT licensed. The bundled typeface (SIL OFL 1.1) and Lucide icons (ISC) keep their own
licences; see
[THIRD_PARTY_NOTICES.md](https://github.com/eckberg/fridgeweek/blob/main/THIRD_PARTY_NOTICES.md).
