# Deploying Fridgeweek

Fridgeweek has three deployments, and the first one is the one most people want.

| | What it needs | What `/api/pdf` does | Cost |
|---|---|---|---|
| **Static files** | Any file host | Nothing; the route is not there | Free |
| **Node** (default) | A machine with Node 26 and Chromium | Renders locally with Playwright | Free |
| **Cloudflare** | A Cloudflare account and the domain as a zone on it | Renders with Browser Rendering | See [What it costs](#what-it-costs) |

Printing from the browser is the primary path in every one of them. It produces the same
pages, works offline, and every browser can save a printout as a PDF. The PDF endpoint only
exists so that one button does it in a single step. Nothing on this page is required to run
Fridgeweek.

## Static files

```sh
pnpm --filter @fridgeweek/web build
```

`apps/web/dist/client` is a complete static site. Upload it anywhere. Delete
`src/pages/api/pdf.ts` first if you would rather not ship a route that answers 501.

## Node (the default)

```sh
pnpm --filter @fridgeweek/web build
node apps/web/dist/server/entry.mjs
```

The PDF route renders with the Chromium that Playwright installs
(`pnpm exec playwright install chromium`, or set `CHROMIUM_PATH` to a browser you already
have). No account, no key, no network. Without a browser, the route answers 501 and the
interface tells people to print instead.

This is what `pnpm dev`, `pnpm build`, `pnpm preview` and the end-to-end tests all use.
Nothing below changes that.

## Cloudflare

What fridgeweek.com runs on. It needs a Cloudflare account on the Workers Paid plan and the
domain as a zone on it. Everything else is in `apps/web/wrangler.jsonc`: the Browser
Rendering binding, a per-IP rate limit on `/api/pdf`, and the hostname. No KV, no D1, no
Durable Object, no secrets, and no account id in the repository.

```sh
DEPLOY_TARGET=cloudflare pnpm --filter @fridgeweek/web build
cd apps/web && pnpm exec wrangler deploy --config dist/server/wrangler.json
```

`DEPLOY_TARGET=cloudflare` is the only switch. Without it the build uses the Node adapter, so
every other command in this repository is unaffected by the existence of this path. The build
writes a merged `dist/server/wrangler.json` — the committed config plus the entry point and
asset binding the adapter adds — and that is the file to deploy. Adding `--dry-run` checks it
without an account.

`wrangler dev` stubs the Browser Rendering binding and its stub has no quick actions, so a
local render answers 502. The rate limiter is real locally. Adding `"remote": true` to the
`browser` binding exercises the real service, and bills for every render.

## What it costs

Browser Rendering is the only part of this project that costs money. Everything else — the
static site, the Worker requests, the rate limiter, printing from the browser — is free or
included.

On the Workers Paid plan ($5/month), as of September 2026, ten hours of browser time a month
are included and further hours are $0.09 each. A sheet is one short render of a few seconds,
so the included time is on the order of ten thousand PDFs. Quick actions are billed for
browser time alone, so the per-browser concurrency charge does not reach this deployment.

The Workers Free plan gives ten minutes of browser time per day and one quick action every
ten seconds across the account: fine for trying it, useless for a deployment.

- <https://developers.cloudflare.com/browser-rendering/platform/pricing/>
- <https://developers.cloudflare.com/browser-rendering/platform/limits/>
- <https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>

## Turning the rate limit up or down

The limit lives in two places that must agree:

- `simple.limit` and `simple.period` in `apps/web/wrangler.jsonc` — what is enforced.
- `RATE_LIMIT_PERIOD_SECONDS` in `apps/web/src/lib/pdf/limits.ts` — what the `Retry-After`
  header promises.

Cloudflare's Rate Limiting binding only accepts a period of 10 or 60 seconds. A deployment
with no limiter binding at all — Node, or a Worker with the entry removed — refuses nothing,
which is how the endpoint behaved before Cloudflare was an option.
