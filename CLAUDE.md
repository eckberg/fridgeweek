# Fridgeweek: notes for Claude Code

Read DESIGN.md first. It is the source of truth for product decisions, the config model,
the layout maths and the module contracts. Keep it in sync with the code.

## Layout
- `packages/core`: `@fridgeweek/core`. Zero runtime dependencies, no DOM. Everything is a pure
  function of `SheetConfig`. Generated files (`*.generated.ts`) come from `pnpm generate`.
  Within the workspace it resolves to its TypeScript source; `publishConfig` points npm at
  `dist`, so nothing needs building before `apps/web` can run.
- `apps/web`: Astro site, static except `/api/pdf`, with one Vue island for the builder.

## Commands (repo root)
- `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint` (Biome; `pnpm lint:fix` formats)
- `pnpm sample` writes example HTML to `examples/out/` and refreshes `docs/preview.svg`
- `pnpm test:visual` runs Playwright sheet screenshots (Linux snapshots are committed)
- `pnpm test:e2e` drives the built site in a browser
- Set `CHROMIUM_PATH` if Playwright cannot find a browser

## Gotchas
- `apps/web` pins TypeScript 6 because `astro check` does not yet support the 7.x compiler API.
  Do not raise it until Astro's language server does.
- Biome does not parse Vue or Astro templates, so unused-symbol rules are off for those files.
  Type checking needs both tools: `astro check` covers `.astro`, `vue-tsc` covers `.vue`.
  Neither covers the other, and `pnpm typecheck` runs both.
- `packages/core` imports its label JSON with `with { type: 'json' }`. Without the attribute the
  published `dist` cannot be loaded by plain Node; `pnpm build` runs `check:dist` to prove it can.
- `playwright-core` must stay external to the SSR bundle, or the PDF route cannot be built
  without it.

## Conventions
- Millimetres everywhere in layout code. Round to 3 decimals; output must be deterministic.
- Never shrink silently: a config that does not fit returns a `LayoutIssue` with remedies.
- Names, symbols, dates: escape text, validate ids, use UTC only.
- Plain imperative commit subjects. English in code, docs and issues.
- Non-goals in DESIGN.md are closed with a link, not argued.
