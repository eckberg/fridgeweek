# Fridgeweek: notes for Claude Code

Read DESIGN.md first. It is the source of truth for product decisions, the config model,
the layout maths and the module contracts. Keep it in sync with the code.

## Layout
- `packages/core`: `@fridgeweek/core`. Zero runtime dependencies, no DOM. Everything is a pure
  function of `SheetConfig`. Generated files (`*.generated.ts`) come from `pnpm generate`.
- `apps/web`: planned Astro + Vue island + Cloudflare Worker. Not created yet.

## Commands (repo root)
- `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint` (Biome; `pnpm lint:fix` formats)
- `pnpm sample` writes example HTML to `examples/out/` and refreshes `docs/preview.svg`
- `pnpm test:visual` runs Playwright screenshots (Linux snapshots are committed)

## Conventions
- Millimetres everywhere in layout code. Round to 3 decimals; output must be deterministic.
- Never shrink silently: a config that does not fit returns a `LayoutIssue` with remedies.
- Names, symbols, dates: escape text, validate ids, use UTC only.
- Plain imperative commit subjects. English in code, docs and issues.
- Non-goals in DESIGN.md are closed with a link, not argued.
