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
