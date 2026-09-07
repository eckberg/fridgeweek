# Fridgeweek design

This document records the product and technical decisions behind Fridgeweek. It is the
reference for contributors and the contract between the packages in this repository. When
code and this document disagree, fix one of them in the same pull request.

## 1. What Fridgeweek is

A web page where you set a handful of parameters and get a print-ready sheet: one week,
seven days top to bottom, filled in **by hand** and stuck on the fridge. No screen, no sync,
no account.

Audience: households with pre-school and early-school children who already draw this sheet
by hand every week and want to stop redrawing the skeleton.

### Non-goals

These are deliberate. Feature requests that cross them are closed with a link here.

- No calendar sync, no accounts, no server-side storage of any kind.
- No content is ever pre-printed except dates. The sheet is a skeleton; the value is that it
  stays paper.
- No screen view, no app, no recurring events.
- No poster aesthetics. The sheet is plain, dense and functional, printed in black on
  whatever paper you have.

## 2. Product decisions

Each decision below was made deliberately during the initial design session. The
"why" matters more than the "what".

| # | Decision | Why |
|---|----------|-----|
| 1 | One column, seven days top to bottom, **equal height** | Children who cannot read find "today" by position. Sunday gets the same space as Wednesday. |
| 2 | Weekday names in **uppercase**, large | Pre-readers recognise capitals first. |
| 3 | Weekend names drawn as **outline text** (toggle) | Separates weekend from weekdays in mono print and can be coloured in. |
| 4 | Each day has **N free writing lines** (1 to 4, default 3) | Real weeks are sparse. A fixed box per person leaves most boxes empty and overflows on busy days. |
| 5 | Every line starts with a **marker strip**: one small mark per person plus a family mark | Circle the mark and the line belongs to that person. Any line can be anyone's. |
| 6 | A mark is either a **symbol** (curated Lucide icons plus a few custom ones) or the person's **initial** | Symbols work for pre-readers and are fun ("I am the unicorn"). Initials are compact and unambiguous for adults. One setting for the whole sheet. |
| 7 | The **family mark** (a house) is the last mark in every strip (toggle, default on) | Household entries ("preschool closed", "grandparents visiting") need an explicit home; an uncircled line is ambiguous. |
| 8 | **Mono only** in v1 | Cheap laser printers. Coloured paper still works. Symbols carry identity so colour is decoration; it can be added later without touching layout. |
| 9 | Header with optional **week number**, **date range** and a **legend** (symbol + name per person) | Week numbers are common in the Nordics and Germany and nearly unknown elsewhere, so the default follows the locale and every element has its own toggle. |
| 10 | **Dates are blank by default**. An optional "week starting" date prints the week number, the range and each day's date | Blank suits printing 20 at a time. Dated suits printing one every Sunday. Same layout either way. |
| 11 | A small **date field** after each weekday name | Makes the sheet unambiguous when it hangs a day too long. |
| 12 | **1 to 6 people** | Six marks plus the family mark fit on a line and cover nearly every household. The UI should warn above four. |
| 13 | Typeface **Atkinson Hyperlegible Next** (OFL), embedded | Designed for maximum letter distinction; ideal for children learning letters. Embedding makes preview, print and PDF identical. |
| 14 | Paper **A4 and Letter**, portrait | Both from day one because the layout is parametric. Letter is what makes the project useful outside Europe. |
| 15 | UI languages **en** and **sv** at launch; weekday names via `Intl` | Adding a language is a JSON file, not a code change. |
| 16 | Dropped from the paper prototype: per-day activity icon strip, clothes-peg marker | With a marker strip on every line a second icon row is noise. Either can return later as an off-by-default toggle. |

## 3. Configuration model

The whole product is a pure function of this object. It is what gets encoded in the URL.

```ts
type PaperSize = 'A4' | 'Letter';
type MarkStyle = 'symbol' | 'initial';
type WeekStart = 'auto' | 'monday' | 'sunday' | 'saturday';

interface Person {
  name: string;       // 1..24 chars, shown in the legend
  symbol: SymbolId;   // id from the curated symbol set
  initial?: string;   // 1..2 chars; defaults to the first character of `name`
}

interface SheetConfig {
  version: 1;
  locale: string;             // BCP 47, e.g. 'sv-SE', 'en-GB'. Default 'en'.
  paper: PaperSize;           // default 'A4'
  marginMm: number;           // 5..20, default 10
  weekStart: WeekStart;       // default 'auto' (from locale)
  showWeekNumber: 'auto' | boolean; // default 'auto' (true for ISO-week locales)
  showDateRange: boolean;     // default true
  showDayDates: boolean;      // default true
  showLegend: boolean;        // default true
  weekStarting?: string;      // 'YYYY-MM-DD'. When set, dates are printed.
  people: Person[];           // 1..6
  markStyle: MarkStyle;       // default 'symbol'
  familyMark: boolean;        // default true
  linesPerDay: number;        // 1..4, default 3
  weekendStyle: 'outline' | 'plain'; // default 'outline'
  copies: number;             // 1..25, default 1. Pages in the PDF.
}
```

Rules:

- `resolveConfig(input)` applies defaults and validates. It never guesses: an invalid
  value is an error with a path and a message, not a silent fallback.
- Two people cannot share a symbol. In `initial` mode two people cannot share an initial
  either; set an explicit `initial` to disambiguate.
- `weekStarting` that is not on the locale's first weekday is snapped back to the previous
  first weekday. The UI should show the snapped date.
- Config is carried in the URL hash, plus in `localStorage` for convenience. There is no
  other persistence. The encoding is described below.

### The link

The link is the sheet, so its length is a product decision and not an implementation
detail: it is pasted into messages, and a mail client decides on its own whether to wrap
it. The hash is packed rather than pretty.

**Format 2, what is written.** Bytes, base64url. Everything with two states is a bit,
`showWeekNumber` and `weekStart` are two bits each, `linesPerDay`, `copies` and the number
of people are small integers sharing bytes, a margin is tenths of a millimetre, a date is
a day offset from 2000-01-01 in two bytes, and a symbol is one byte: its number in
`SYMBOL_CODES`. Only names are text, because only names are unpredictable. The defaults
come to 20 characters and a two-person sheet with a date and a language to about 30, down
from about 240.

`SYMBOL_CODES` in `packages/core/src/symbols/codes.ts` is therefore append-only.
`SYMBOL_IDS` stays sorted for the picker; renumbering it would change what every link
already sent means. A test fails on a symbol missing from the table.

**Format 1, still read.** The original encoding: base64url JSON holding the fields that
differ from the defaults. Links already shared and configurations already in
`localStorage` are in it, so `decodeConfig` accepts both formats; the first byte tells
them apart, because JSON starts with `{`. It is also still written for the one
configuration format 2 cannot hold, a margin that is not a whole tenth of a millimetre.
Rounding it would be the silent guess this project does not make.

Not a URL shortener: that is a server storing sheets, which is the thing this project does
not have, and it would put a household's names in somebody's database. The hash never
leaves the browser. Shorter had to come out of the encoding.

## 4. Layout engine

The hard part is not the look, it is the **height budget**. The engine is a pure function
`computeLayout(config) -> Layout` that returns every coordinate in millimetres, plus a list
of issues. It never shrinks anything silently: when a configuration does not fit it returns
an `error` issue with concrete remedies.

All numbers are millimetres. Constants live in `packages/core/src/layout.ts`.

```
paper          A4 210 x 297, Letter 215.9 x 279.4
usable         paper - 2 * margin
header         HEADER_H 15 + HEADER_GAP 4, present if weekNumber || dateRange || legend
dayH           (usableH - header) / 7                     (A4, m=10: 36.86)
headH          clamp(dayH * HEAD_RATIO .26, 6, 9.5),      capped so the lines keep
               their comfort height before the band keeps its own
lineH          (dayH - headH - padTop 1.8 - padBottom 1.4) / linesPerDay   (A4, 3: 8.05)
markSize       clamp(lineH * MARK_RATIO .55, 3.5, 4.6)                     (A4, 3: 4.43)
stripW         marks * markSize + (marks - 1) * MARK_GAP 1.6
ruleStart      content.x + STRIP_INSET 1 + stripW + STRIP_GAP 4.5
ruleY          bottom of the line band - RULE_LIFT 1.2
```

Placement rules that are not just numbers:

- Marks are **centred** in their line band, so every line has the same rhythm.
- The day date is **right-aligned at the content edge**, forming one column down
  the sheet rather than following each weekday name's width. The name shrinks to fit
  what is left.
- The legend symbol is **the same size as a strip mark**, so a sheet has one icon size.

Thresholds:

- `MIN_LINE_H = 6` mm: below this a line is unwritable with a normal pen (narrow-ruled paper
  is 6.35 mm). Error.
- `COMFORT_LINE_H = 8` mm: below this the engine emits a warning ("tight").
- `MIN_WRITE_W = 100` mm: the writing rule after the strip must be at least this wide.

Consequences: on A4 with a 10 mm margin, three lines are comfortable at 8.05 mm, four are
tight at about 6 mm, five never fit (hence the cap at four). Letter is 17.6 mm shorter, about
2.5 mm per day, so four lines on Letter sit right at the floor.

The legend in the header wraps into up to three rows (the third one shorter) before the
engine reports an overflow.

Remedies are listed in order in the issue: fewer lines per day, smaller margin, hide the
legend (removes the header when nothing else needs it).

Long weekday names (German "DONNERSTAG", Finnish "KESKIVIIKKO") are handled by estimating
text width from an average glyph width and shrinking the font size until the name fits
beside the date field. The visual test covers the widest locales.

## 5. Rendering

`renderSvg(config) -> string` emits one SVG whose user unit is the millimetre
(`viewBox="0 0 210 297"`, `width="210mm"`). Every coordinate comes from `computeLayout`.
Symbols are inline `<symbol>` definitions on a 24-unit grid referenced with `<use>`.
Outline weekday names are plain SVG text with `fill="none"` and a stroke, so no CSS
vendor tricks are needed.

`renderSheet(config) -> string` wraps `copies` SVG pages in a self-contained HTML
document: `@page { size: A4; margin: 0 }`, embedded WOFF2 fonts as `data:` URIs, no
external references. This is the file that is previewed, printed and sent to the PDF
renderer.

Determinism: the output depends only on the config. No timestamps, no randomness, numbers
rounded to three decimals. Snapshot tests rely on this.

## 6. Dates and language

- Weekday names: `Intl.DateTimeFormat(locale, { weekday: 'long' })`, uppercased with
  `toLocaleUpperCase(locale)`.
- First day of week and week-numbering rules: `Intl.Locale#getWeekInfo()` (or the
  `weekInfo` getter in WebKit) with a small fallback table for engines without it.
- Week number: computed from the locale's `firstDay` and `minimalDays`. ISO 8601 when they
  are Monday and 4.
- `showWeekNumber: 'auto'` is true when `minimalDays === 4`, which is the ISO family of
  locales (most of Europe), and false otherwise.
- Day dates and date ranges are formatted with `Intl.DateTimeFormat` so "14/9" and "9/14"
  come out right for free.
- **The sheet is translated; the interface is not.** The sheet is the product, so it
  prints correctly in a family's own language. The website around it is English, which
  keeps one set of words to maintain and one page to review.
- Almost everything printed comes from `Intl`, so a sheet is correct in far more
  languages than are listed anywhere. Exactly two words are the project's own, "Week"
  and "Everyone", and they live in `packages/core/src/i18n/locales/<lang>.json`. A
  locale with no file still prints a correct sheet: those two words fall back to English.
- `SHEET_LOCALES` in that folder's `index.ts` is the list the language picker offers:
  the languages where every printed word is right. Adding one is a two-line JSON file
  plus an entry in that list, documented in CONTRIBUTING.md.
- Symbol names are shown in the picker and never printed, so they are English only.

## 7. Architecture

```
packages/core   @fridgeweek/core - config, layout, SVG/HTML renderer, symbols, fonts, dates,
                i18n. Strict TypeScript, zero runtime dependencies, no DOM. Publishable.
apps/web        Astro site with a Vue island for the config panel, live preview of the SVG,
                and /api/pdf. Static except that one route.
```

Why SVG from a layout function rather than HTML + CSS: the geometry is deterministic and
unit-testable without a browser, the preview is literally the printed page, and there is no
flexbox rounding or `@page` drift between browsers.

Why a server-side PDF: the browser print dialog is the free fallback and works offline, but
Firefox, Safari and Chrome disagree about margins, scaling and headers. Rendering the same
HTML in headless Chromium gives every family an identical PDF. It is never the only way to
get one.

### The PDF endpoint

`POST /api/pdf` takes a configuration and nothing else, validates it with the same function
the browser uses, and streams the bytes back. Nothing is stored, logged or identified.

A renderer implements one interface, `PdfRenderer`, and `resolveRenderer(env)` picks one per
request:

```
apps/web/src/lib/pdf/handler.ts     the endpoint's decisions, as a function of (request, env)
apps/web/src/lib/pdf/renderer.ts    the PdfRenderer interface and resolveRenderer(env)
apps/web/src/lib/pdf/local.ts       Playwright's Chromium. No account, no key, no network.
apps/web/src/lib/pdf/cloudflare.ts  Cloudflare Browser Rendering, from inside the Worker
apps/web/src/lib/pdf/limits.ts      the page cap and the rate limiter
apps/web/src/lib/pdf/runtime.ts     finding the Worker environment, when there is one
```

Three deployments, one codebase:

- **Static files.** The route is not there, or answers 501. Printing from the browser is the
  whole product and works offline.
- **Node** (the default adapter). `local.ts` renders with the Chromium Playwright installs.
  This is what `dev`, `build`, `preview` and the end-to-end tests use.
- **Cloudflare.** `DEPLOY_TARGET=cloudflare` selects the Cloudflare adapter at build time.
  `cloudflare.ts` renders through the `BROWSER` binding's `pdf` quick action, passing the
  document as HTML rather than as a URL so that nothing has to be published to be rendered.
  `DEPLOY_TARGET` is a build-time constant, not a runtime one: it is what lets Vite drop
  Playwright from the Worker bundle and `cloudflare:workers` from the Node bundle.

The renderer is chosen from the request's environment, never cached: a binding belongs to the
request it arrived with. The local Chromium is cached, because launching it costs a second
and the process outlives the request.

Two limits, because a public endpoint that starts browsers is the only part of this project
that can cost real money:

- **25 pages per request.** The same number as `LIMITS.copies.max`, so there is one real
  limit rather than two that can disagree. The endpoint checks it again itself, because it
  validates untrusted input and should not be uncapped by a change to the schema.
- **Five requests per minute per client IP**, keyed on `CF-Connecting-IP`, enforced by
  Cloudflare's Rate Limiting binding and nothing else — no KV, no D1, no Durable Object, so
  the deployment needs no storage product. Refusal is 429 with `Retry-After`. A deployment
  with no limiter binding refuses nothing, which is how the endpoint has always behaved.

Deliberately not done: no challenge in front of the button, and no account of any kind. A
challenge is a third-party script on a page that otherwise makes no third-party requests, and
the rate limit plus the page cap bound the spend well enough to try without one.

See [docs/DEPLOYING.md](docs/DEPLOYING.md) for what each deployment needs and what it costs.

### Core module contracts

These are the exported surfaces other modules build against.

```ts
// src/config.ts
resolveConfig(input: unknown): SheetConfig            // throws ConfigError
validateConfig(input: unknown): ValidationResult
DEFAULT_CONFIG: SheetConfig

// src/encoding.ts
encodeConfig(config: SheetConfig): string             // base64url, packed
decodeConfig(encoded: string): SheetConfig            // reads both formats, throws ConfigError

// src/layout.ts
computeLayout(config: SheetConfig): Layout            // mm, with issues[]

// src/render.ts
renderSvg(config: SheetConfig, options?: RenderOptions): string
renderSheet(config: SheetConfig, options?: RenderOptions): string

// src/symbols/index.ts
SYMBOL_IDS: readonly SymbolId[]
getSymbol(id: SymbolId): SymbolDef                    // { id, body, source, labels }
isSymbolId(x: unknown): x is SymbolId
FAMILY_SYMBOL: SymbolId                               // 'house'

// src/fonts/index.ts
FONT_FAMILY, FONT_STACK
fontFaceCss(): string                                 // @font-face with data: URIs

// src/dates.ts
getWeekInfo(locale): WeekInfo                         // { firstDay 1..7, minimalDays, weekend }
weekOrder(firstDay): Weekday[]                        // 7 days starting at firstDay
weekdayName(locale, weekday, form): string
weekNumber(date, weekInfo): { week, year }
alignToWeekStart(date, firstDay): IsoDate
formatDayDate(locale, date): string
formatDateRange(locale, start, end): string
addDays, parseIsoDate, toIsoDate                      // UTC-only helpers

// src/i18n/index.ts
t(locale, key): string                                // chrome strings, falls back to en
SUPPORTED_UI_LOCALES
```

## 8. Testing

- Unit tests (Vitest) for config validation, encoding round-trips, week numbers, week
  info fallbacks, and the layout solver across A4/Letter, 1 to 6 people, 1 to 4 lines,
  with and without header elements.
- Snapshot tests of the SVG for a small set of representative configs.
- Visual test (Playwright, CI only): render the HTML at print media and compare against
  committed screenshots for the widest-name locales. This catches font and margin
  regressions that unit tests cannot.

## 9. Milestones

- **v0.1** `@fridgeweek/core`: config, layout, renderer, symbols, fonts, dates, i18n, tests,
  and a script that writes sample HTML files.
- **v0.2** `apps/web`: config panel, live preview, URL and localStorage state, browser print.
- **v0.3** `/api/pdf` on Cloudflare Browser Rendering with rate limiting and `copies`.
- **v1.0** README with pictures, CONTRIBUTING with the add-a-language recipe, example
  links, npm publish of core.
