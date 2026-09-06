# Contributing to Fridgeweek

Thanks for looking. The two contributions we want most are a new language and a new symbol, and both have a recipe below.

## Setup

You need Node 22 and pnpm 10 (`corepack enable`). See the [README](README.md#development) for the full command list. The short version:

```sh
pnpm install
pnpm test
pnpm lint
```

`pnpm sample` writes example sheets to `examples/out/`. Open them in a browser and print to see the real result.

To work on the website:

```sh
pnpm --filter @fridgeweek/web dev     # http://localhost:4321
pnpm exec playwright install chromium # once; also turns on the local PDF button
pnpm test:e2e                         # drives the built site in a browser
```

Everything runs on your own machine. No account, key or hosting platform is needed for any part of this project, and a change that would make one necessary needs discussing first.

## Ground rules

- `@fridgeweek/core` has no runtime dependencies and no DOM access. It must keep running unchanged in Node, in a browser and in a Worker. Dev dependencies are fine.
- Every layout change needs a unit test. The layout engine is a pure function, so there is no excuse for an untested branch.
- Every visual change needs the visual snapshots regenerated, and the pull request must explain the diff. A snapshot that changed for a reason you cannot name is a bug.
- Type checking takes two tools: `astro check` for `.astro` files and `vue-tsc` for `.vue` files. Neither covers the other, and `pnpm typecheck` runs both. Biome does not parse either template language, so unused-symbol rules are switched off for those files.
- Read [DESIGN.md](DESIGN.md) before proposing a feature. It records why each decision was made. Requests that cross the non-goals are closed with a link to that section; this is not a judgement of the idea, it is a scope boundary.

## Adding a language

Every translation in the repository was drafted by its author rather than by a native speaker, so **corrections to an existing language are as welcome as a new one**. If something reads stiffly or is simply wrong in your language, please open a pull request; you do not need to justify it beyond being a speaker.

A language lives in three places. Take them in this order:

1. **The interface.** Copy `apps/web/src/i18n/locales/en.json` to `<lang>.json` and translate the values, keeping the keys exactly as they are and every `{placeholder}` intact. Add the language to `UI_LOCALES` in `apps/web/src/i18n/index.ts` with its own name for itself, and register it in `apps/web/src/i18n/catalogues.ts`.
2. **The symbol names.** Copy `packages/core/src/symbols/labels/en.json` to `<lang>.json`, translate the 65 nouns, and add the language to the table in `packages/core/src/symbols/labels.ts`. These are what the picker and screen readers say.
3. **The few words printed on the sheet.** Copy `packages/core/src/i18n/locales/en.json` to `<lang>.json` and add the code to `SUPPORTED_UI_LOCALES` in that folder's `index.ts`.

Then check it on paper:

4. Weekday names and date formats come from `Intl`, so there is nothing to translate there. Run `pnpm sample` and check that the longest weekday name in your language still fits beside the date column, on both A4 and Letter. The known wide ones are German "Donnerstag", Finnish "keskiviikko" and Portuguese "quarta-feira".
5. If your language has an unusual first day of week or week-numbering rule that `Intl` gets wrong, add it to the fallback table in `packages/core/src/dates.ts` with a test.
6. Run `pnpm test` and `pnpm lint`, then open a pull request with a screenshot of a sample sheet in the new language.

The tests check that every catalogue has exactly the English key set, uses the same placeholders, and is not simply a copy of English, so a partial or accidental translation is caught before review. A key a translation has not covered falls back to English at runtime rather than breaking, so a partial translation is still worth opening.

## Adding a symbol

Lucide icons are preferred, because they are already consistent with the rest of the set.

1. Add the icon id to `LUCIDE_IDS` in `packages/core/src/symbols/curated.ts`.
2. Run `pnpm generate` to copy the icon into the generated module.
3. Add a name for it to `packages/core/src/symbols/labels/en.json`, which is required, and to as many of the other language files as you can. A missing English name is a compile error; a missing translation falls back to English.

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
