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
- Every pnpm setting lives in `pnpm-workspace.yaml`. From pnpm 11 only auth and registry
  settings are read from `.npmrc`, and pnpm 12 fails the command on a key it does not
  recognise, so a typo there is an error rather than a silent no-op. Two entries need
  explaining: a dependency that runs a build script must be listed in `allowBuilds` or the
  install fails, and `@cloudflare/workers-types` is exempt from the release-age policy
  because it publishes a new date-stamped version every morning.
- Biome does not parse Vue or Astro templates, so unused-symbol rules are off for those files.
  Type checking needs both tools: `astro check` covers `.astro`, `vue-tsc` covers `.vue`.
  Neither covers the other, and `pnpm typecheck` runs both.
- `packages/core` imports its label JSON with `with { type: 'json' }`. Without the attribute the
  published `dist` cannot be loaded by plain Node; `pnpm build` runs `check:dist` to prove it can.
- Playwright must stay at 1.60 or newer. Its bundled zip extractor never settles on Node 26, so
  every earlier version hangs forever unpacking the browser instead of failing, and the CI job
  ran to the six-hour ceiling. The three pins move together: `@playwright/test` in both packages
  and `playwright-core` in `apps/web`.
- `playwright-core` must stay external to the SSR bundle, or the PDF route cannot be built
  without it.
- `apps/web` builds for Node unless `DEPLOY_TARGET=cloudflare` is set, which swaps the adapter
  in `astro.config.mjs`. Both adapters are dependencies; only one is active per build, and
  `dev`, `preview` and the e2e suite always use Node. `__DEPLOY_TARGET__` is a Vite `define`,
  not an environment variable, precisely so the branches it guards are *removed*: the Worker
  must not contain Playwright and the Node bundle must not contain `cloudflare:workers`. Set
  it in `vitest.config.ts` too, or tests hit an undefined global.
- `@astrojs/cloudflare` v14 removed `Astro.locals.runtime.env`; the getter throws. Worker
  bindings come from `import { env } from 'cloudflare:workers'`, dynamically, behind that same
  build-time constant.
- `@cloudflare/workers-types` is a dev dependency, imported as types only. Do not add it to
  `types` in a tsconfig: its globals collide with the DOM ones Astro relies on.
- `wrangler dev` stubs the Browser Rendering binding and its stub has no quick actions, so a
  local render answers 502. The rate limiter, though, is real locally and worth rehearsing.

## Languages
The sheet is translated because it is the output. The website is English on purpose.
- `packages/core/src/i18n/locales/*.json` holds the two words printed on a sheet.
  `SHEET_LOCALES` is what the picker offers; an unlisted locale still prints correctly.
- `apps/web/src/i18n/locales/en.json` is the interface vocabulary, English only. A test
  fails on a key the code does not use and on a key the code asks for and does not exist.
- Symbol names are never printed, so they are English only.

## Conventions
- Millimetres everywhere in layout code. Round to 3 decimals; output must be deterministic.
- Never shrink silently: a config that does not fit returns a `LayoutIssue` with remedies.
- Names, symbols, dates: escape text, validate ids, use UTC only.
- Plain imperative commit subjects. English in code, docs and issues.
- Non-goals in DESIGN.md are closed with a link, not argued.
