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

## Ground rules

- `@fridgeweek/core` has no runtime dependencies and no DOM access. It must keep running unchanged in Node, in a browser and in a Worker. Dev dependencies are fine.
- Every layout change needs a unit test. The layout engine is a pure function, so there is no excuse for an untested branch.
- Every visual change needs the visual snapshots regenerated, and the pull request must explain the diff. A snapshot that changed for a reason you cannot name is a bug.
- Read [DESIGN.md](DESIGN.md) before proposing a feature. It records why each decision was made. Requests that cross the non-goals are closed with a link to that section; this is not a judgement of the idea, it is a scope boundary.

## Adding a language

1. Copy `packages/core/src/i18n/locales/en.json` to `packages/core/src/i18n/locales/<lang>.json` and translate the values. Keep the keys exactly as they are.
2. Add the language code to `SUPPORTED_UI_LOCALES` in `packages/core/src/i18n/index.ts`.
3. Add symbol labels for the language in `packages/core/src/symbols/labels.ts`. Every symbol needs a label; the type checker will tell you if one is missing.
4. Weekday names and date formats come from `Intl`, so there is nothing to translate there. Do run `pnpm sample` and check that the longest weekday name in the language still fits beside the date field, on both A4 and Letter. The known wide ones are German "Donnerstag", Finnish "keskiviikko" and Portuguese "quarta-feira".
5. If your language has an unusual first day of week or week-numbering rule that `Intl` gets wrong in your browser, add it to the fallback table in `packages/core/src/dates.ts` and add a test for it.
6. Run `pnpm test` and `pnpm lint`, then open a pull request with a screenshot of a sample sheet in the new language.

## Adding a symbol

Lucide icons are preferred, because they are already consistent with the rest of the set.

1. Add the icon id to `LUCIDE_IDS` in `packages/core/src/symbols/curated.ts`.
2. Run `pnpm generate` to copy the icon into the generated module.
3. Add a label for the symbol in every language in `packages/core/src/symbols/labels.ts`.

If the icon you need does not exist in Lucide, draw it and put it in `packages/core/src/symbols/custom.ts`. Follow the Lucide conventions so it sits beside the others:

- 24 by 24 grid.
- 2 unit stroke width, round caps and round joins.
- No `fill` or `stroke` attributes on the paths. The renderer sets them.
- At least 1 unit of padding on every side.
- Readable at 5 mm on paper, which in practice means very few strokes. Detail disappears at that size.

Custom icons are contributed under the project's MIT license.

## Pull request checklist

- `pnpm test` passes.
- `pnpm lint` passes.
- DESIGN.md is updated if behaviour changed.
- Screenshots are attached for visual changes.

## Commit style

Plain imperative subject lines, for example "Add Finnish locale" or "Fix week number for Saturday-start locales". There is no enforced convention and no commit linting.
