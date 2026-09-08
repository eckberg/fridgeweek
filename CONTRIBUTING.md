# Contributing to Fridgeweek

Thanks for looking. The two contributions we want most are a new language and a new symbol, and both have a recipe below.

## Setup

You need Node 26 and pnpm 12 (`npm install -g pnpm@12`). See the [README](README.md#development) for the full command list. The short version:

```sh
pnpm install
pnpm test
pnpm lint
```

`pnpm sample` writes example sheets to `examples/out/`. Open them in a browser and print to see the real result.

To work on the website:

```sh
pnpm dev             # http://localhost:4321
pnpm test:e2e        # drives the built site in a browser

# Once, for the browser tests and the local PDF button. Playwright belongs to the
# workspace packages, not the root, so this needs --filter to resolve.
pnpm --filter @fridgeweek/web exec playwright install chromium
```

Everything runs on your own machine. No account, key or hosting platform is needed for any part of this project, and a change that would make one necessary needs discussing first.

## Ground rules

- `@fridgeweek/core` has no runtime dependencies and no DOM access. It must keep running unchanged in Node, in a browser and in a Worker. Dev dependencies are fine.
- Every layout change needs a unit test. The layout engine is a pure function, so there is no excuse for an untested branch.
- Every visual change needs the visual snapshots regenerated, and the pull request must explain the diff. A snapshot that changed for a reason you cannot name is a bug.
- Type checking takes two tools: `astro check` for `.astro` files and `vue-tsc` for `.vue` files. Neither covers the other, and `pnpm typecheck` runs both. Biome does not parse either template language, so unused-symbol rules are switched off for those files.
- Read [DESIGN.md](DESIGN.md) before proposing a feature. It records why each decision was made. Requests that cross the non-goals are closed with a link to that section; this is not a judgement of the idea, it is a scope boundary.

## Adding a language

The **sheet** is translated. The website around it is English on purpose: it keeps one set of words to maintain, and the sheet is the thing that ends up on the fridge.

Most of what a sheet prints already works in your language without anyone doing anything, because weekday names, day dates and the date range all come from `Intl`. Exactly two words are the project's own.

1. Create `packages/core/src/i18n/locales/<lang>.json` with those two words:

   ```json
   { "sheet.week": "Vecka", "sheet.family": "Alla" }
   ```

   `sheet.week` labels the week-number box. `sheet.family` names the household mark in the legend, so it should read as "everyone" rather than as "family".

2. Add the language to `SHEET_LOCALES` in `packages/core/src/i18n/index.ts`, with its own name for itself. That list is what the language picker offers.

3. If your language has an unusual first day of week or week-numbering rule that `Intl` gets wrong, add it to the fallback table in `packages/core/src/dates.ts` with a test.

4. Run `pnpm sample` and check that the longest weekday name in your language still fits beside the date column, on both A4 and Letter. The known wide ones are German "Donnerstag", Finnish "keskiviikko" and Portuguese "quarta-feira".

5. Run `pnpm test` and `pnpm lint`, then open a pull request with a screenshot of a sample sheet in the new language.

Every translation here was written by its author rather than by a native speaker, so **corrections are as welcome as new languages**. If a word reads wrong in your language, please say so; you do not need to justify it beyond being a speaker.

A locale with no file is not broken. Its sheet prints with correct weekday names and dates, and those two words fall back to English.

## Adding a symbol

Lucide icons are preferred, because they are already consistent with the rest of the set.

1. Add the icon id to `LUCIDE_IDS` in `packages/core/src/symbols/curated.ts`.
2. Run `pnpm generate` to copy the icon into the generated module.
3. Add a name for it to `packages/core/src/symbols/labels/en.json`. A symbol without a name is a compile error. These names appear in the picker and to screen readers, never on the printed sheet, so they are English only.

If the icon you need does not exist in Lucide, draw it and put it in `packages/core/src/symbols/custom.ts`. Follow the Lucide conventions so it sits beside the others:

- 24 by 24 grid.
- 2 unit stroke width, round caps and round joins.
- No `fill` or `stroke` attributes on the paths. The renderer sets them.
- At least 1 unit of padding on every side.
- Readable at 5 mm on paper, which in practice means very few strokes. Detail disappears at that size.

Custom icons are contributed under the project's MIT license.

## Pull request checklist

- `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` pass.
- `pnpm test:e2e` passes if you changed the website.
- DESIGN.md is updated if behaviour changed.
- Screenshots are attached for visual changes.

## Commit style

Plain imperative subject lines, for example "Add Finnish locale" or "Fix week number for Saturday-start locales". There is no enforced convention and no commit linting.
