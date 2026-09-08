# Third party notices

Fridgeweek itself is MIT licensed. It bundles the assets below, which keep their own licenses.

| Component | Copyright | License | Source | How it is used |
|---|---|---|---|---|
| Atkinson Hyperlegible Next | The Atkinson Hyperlegible Next Project Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/atkinson-hyperlegible-next | The WOFF2 files are embedded as `data:` URIs in generated HTML, so a sheet renders and prints identically everywhere. The full license text ships in `packages/core/assets/fonts/OFL.txt`. |
| Caveat | The Caveat Project Authors | SIL Open Font License 1.1 | https://github.com/googlefonts/caveat | One handwritten line on the landing page, showing what a filled-in row looks like. Screen only; it is never used on a printed sheet. The WOFF2 and the full license text ship in `apps/web/public/fonts/`. |
| Lucide | Lucide Contributors | ISC | https://lucide.dev | A curated subset of icons is copied into `packages/core/src/symbols/lucide.generated.ts` at build time. Some Lucide icons derive from Feather (MIT, Copyright (c) 2013-2023 Cole Bemis). |

Fridgeweek also loads one hosted service rather than bundling it: [Fathom
Analytics](https://usefathom.com) counts page views and two events. It is cookieless and
aggregate, sets no identifiers, respects Do Not Track, and never receives anything typed into the
builder. It is not part of anything this project publishes, and a deployment that removes the
snippet from `apps/web/src/layouts/BaseLayout.astro` needs no other change.

## Printed sheets

Neither license places any attribution requirement on the sheets you print. A printed Fridgeweek sheet carries no notice, no credit line and no logo. The OFL governs redistribution of the font files themselves, and the ISC license governs redistribution of the icon source; using the rendered output on paper is not redistribution of either.
