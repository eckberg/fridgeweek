# Build plan: v0.2, local first

The goal of this phase is a complete, locally runnable Fridgeweek: a landing page, a sheet
builder with live preview, an about page, and a PDF download that works on a laptop with no
Cloudflare account, no domain and no analytics. Every external service is behind an interface
with a local implementation, so hosting decisions stay reversible.

Design source: the Claude Design brand system (landing, app, about, brand and sheet boards).
Its tokens and page structures are the specification for `apps/web`.

## Phases

### Phase 1: Sheet refinement in core
The design board "Fridgeweek Sheet v2" specifies new layout constants. Nothing structural
changes; the marks shrink, the strip gains a gutter, day dates right-align into a column, and
days get breathing room. Applied to `packages/core/src/layout.ts` with tests and snapshots
re-recorded.

### Phase 2: Web application shell
`apps/web` as an Astro site with a Vue island for the builder. Static output by default so it
runs from any file server; the PDF route is the only server endpoint and is optional.

- Design tokens as CSS custom properties in one stylesheet, derived from the brand board.
- Self-hosted fonts (Atkinson Hyperlegible Next, IBM Plex Mono) from the repository, so the
  site has no network dependencies and looks the same offline.
- Page chrome: header with the paper-bird mark, footer with the legal and source links.

### Phase 3: The builder
A Vue island holding a `SheetConfig`, rendering the sheet through `@fridgeweek/core` and
writing the config to the URL hash and `localStorage`.

- Controls: language, people (add, remove, rename, symbol picker, initial), family mark, mark
  style, lines per day, weekend style, week starting, header toggles, paper, margin, copies.
- Live preview in an iframe, so print CSS and millimetre units behave exactly as they will on
  paper.
- Layout issues surfaced as they come from the engine, with their remedies.

### Phase 4: Content pages
Landing page and a single prose page covering about, terms and privacy, both from the design
boards. Static, no island.

### Phase 5: PDF
`POST /api/pdf` validates a config, renders the HTML through `@fridgeweek/core` and converts
it with a **PDF renderer interface**:

- `LocalChromiumRenderer` drives the Chromium that Playwright already installs. Works on a
  laptop with no account.
- `CloudflareBrowserRenderer` is a documented placeholder for later.

Print from the browser stays the primary, free path and works with no server at all.

### Phase 6: Quality
Unit tests for URL state and the config store, Playwright end-to-end tests for the builder,
axe accessibility checks on every page, a full code review pass, and documentation updates.

## Principles for this phase

- No account, key or paid service is needed to run or test anything.
- `packages/core` stays framework-free and dependency-free; the web app depends on it, never
  the reverse.
- Anything that cannot be decided without the maintainer gets a placeholder, a `TODO(karl)`
  comment and an entry in the open questions list at the end.

---

## What was built

Every phase above landed. The whole project runs on a laptop with no account,
key or hosting platform.

| Phase | Outcome |
|---|---|
| 1. Sheet refinement | Applied. Marks centred and smaller, a 4.5 mm gutter before the writing rule, day dates right-aligned into one column, more air under the weekday name, one icon size per sheet. Metrics match the design's proposed numbers (line 8.05 mm, mark 4.43 mm). |
| 2. Web shell | Astro site, static except one route, with design tokens from the brand system, self-hosted fonts and no third-party requests. |
| 3. The builder | A Vue island: language, people with a searchable symbol picker, family mark, mark style, lines per day, weekend style, week starting, four header toggles, paper, margin and copies, with a live preview and the engine's own fit report. |
| 4. Content pages | A landing page that renders two real sheets at build time, and one prose page covering about, privacy, terms and licences. |
| 5. PDF | `POST /api/pdf` behind a renderer interface. A local Chromium implementation needs nothing external; a deployment without one answers 501 and the interface says to print instead. |
| 6. Quality | 319 unit tests, 19 browser tests, 6 sheet screenshots, axe on all three pages, and a code review whose findings were fixed. |

Beyond the plan: the interface, the symbol names and the sheet's own words are
translated into fifteen languages.

## Deliberately not done

- **Locale routes for the static pages.** The builder is fully translated at
  runtime, but the landing and about pages are English. Translating them means
  fifteen route trees, which is a decision about the shape of the site rather
  than a missing piece of work.
- **A hosted PDF renderer.** Sketched in `apps/web/src/lib/pdf/cloudflare.ts`
  and deliberately not built; see the open questions.
- **Analytics.** None, and the privacy page says so.
