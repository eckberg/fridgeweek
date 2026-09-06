# @fridgeweek/core

The engine behind [Fridgeweek](https://github.com/eckberg/fridgeweek): config, layout and rendering for a printable weekly sheet. Everything is a pure function of the config object.

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
t(locale, key): string                         // chrome strings, falls back to en
SUPPORTED_UI_LOCALES
```

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

Open `sheet.html` in a browser and print it. `renderSvg` gives you the single page instead, if you want to embed it.

## Notes

No runtime dependencies. No DOM access. It runs the same in Node, in a browser and in a Cloudflare Worker.

`pnpm generate` regenerates the icon and font modules from `lucide-static` and the files in `assets/`. Run it after changing the curated symbol list; the generated modules are committed.
