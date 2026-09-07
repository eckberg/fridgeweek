# Deploying Fridgeweek

Fridgeweek has three deployments, and the first one is the one most people want.

| | What it needs | What `/api/pdf` does | Cost |
|---|---|---|---|
| **Static files** | Any file host | Nothing; the route is not there | Free |
| **Node** (default) | A machine with Node 22 and Chromium | Renders locally with Playwright | Free |
| **Cloudflare** | A Cloudflare account | Renders with Browser Rendering | See [What it costs](#what-it-costs) |

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

> **Unverified.** This path was built and tested against Cloudflare's documented interfaces
> and its published TypeScript types, and exercised in a local `workerd` through
> `wrangler dev`. It has never run against a real Cloudflare account. Treat the first deploy
> as the real test and work through [Verifying](#verifying-the-first-deploy) below.

### What to create in the dashboard

Almost nothing, which is the point. This deployment uses no KV namespace, no D1 database and
no Durable Object.

1. **A Cloudflare account on the Workers Paid plan.** Browser Rendering works on the free
   plan too, but its allowance is ten minutes of browser time *per day* across the whole
   account, and its quick actions are capped at one request every ten seconds. That is a toy,
   not a deployment.
2. **Nothing else.** The browser and the rate limiter are both bindings declared in
   `apps/web/wrangler.jsonc`; neither is a resource you create beforehand. Rate Limiting
   namespaces in particular are not dashboard objects — the `namespace_id` in the config file
   is a number you pick, unique within the Worker.

### What is in the wrangler file

`apps/web/wrangler.jsonc` is committed and contains no account id, no zone id and no token.
`wrangler` takes the account from your login. The entries are:

- `compatibility_date: "2026-03-24"` — the earliest date that supports Browser Rendering
  quick actions.
- `compatibility_flags: ["nodejs_compat"]` — what Astro's Cloudflare adapter asks for.
- `browser: { binding: "BROWSER" }` — Browser Rendering.
- `ratelimits: [{ name: "PDF_RATE_LIMITER", namespace_id: "1001", simple: { limit: 5, period: 60 } }]`
  — five PDF requests per minute per client IP.

`main` and the static-asset binding are filled in by `@astrojs/cloudflare` at build time and
are deliberately absent from the file.

### Deploying

```sh
pnpm install
npx wrangler login
DEPLOY_TARGET=cloudflare pnpm --filter @fridgeweek/web build
cd apps/web && npx wrangler deploy --config dist/server/wrangler.json
```

`DEPLOY_TARGET=cloudflare` is the only switch. Without it the build uses the Node adapter, so
every other command in this repository is unaffected by the existence of this path. The build
writes a merged `dist/server/wrangler.json` — your `wrangler.jsonc` plus the entry point and
asset binding the adapter adds — and that is the file to deploy.

### Verifying the first deploy

1. **The site loads and printing works.** Open `/sheet`, build a sheet, print it from the
   browser. This path touches nothing on this page and must work whatever else does.
2. **A PDF comes back.**
   ```sh
   curl -si -X POST https://<your-worker>/api/pdf \
     -H 'content-type: application/json' \
     -d '{"copies":1,"locale":"sv-SE","weekStarting":"2026-09-07"}' -o sheet.pdf
   file sheet.pdf   # PDF document
   ```
   Open it. The typeface must be Atkinson Hyperlegible Next, the page A4, the margins zero.
   If it is 501, the `BROWSER` binding did not attach. If it is 502, the render failed: check
   `wrangler tail` for what Browser Rendering answered.
3. **Twenty-five pages, and no more.**
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<your-worker>/api/pdf \
     -H 'content-type: application/json' -d '{"copies":25}'   # 200
   curl -s -w '\n%{http_code}\n' -X POST https://<your-worker>/api/pdf \
     -H 'content-type: application/json' -d '{"copies":26}'   # 422
   ```
4. **The limiter engages.** Six requests in a minute from one address; the sixth must be
   refused.
   ```sh
   for i in $(seq 1 6); do
     curl -s -o /dev/null -w "$i %{http_code} retry-after=%header{retry-after}\n" \
       -X POST https://<your-worker>/api/pdf \
       -H 'content-type: application/json' -d '{"copies":1}'
   done
   ```
   Expect five answers, then `429 retry-after=60`. If every request succeeds, the
   `ratelimits` entry did not make it into the deployed configuration: check
   `dist/server/wrangler.json` and `wrangler deploy --dry-run`.
5. **Watch the spend for a day.** Workers → your Worker → Browser Rendering shows browser
   time used. It should be a few seconds per PDF.

`wrangler dev` is only a partial rehearsal: the local Browser Rendering stub does not
implement quick actions, so a local render answers 502. The rate limiter *is* implemented
locally, so step 4 can be rehearsed before deploying. To exercise the real browser from your
machine, add `"remote": true` to the `browser` binding in `wrangler.jsonc` — that bills your
account for every render.

## What it costs

Browser Rendering is the only part of this project that costs money. Everything else — the
static site, the Worker requests, the rate limiter, printing from the browser — is free or
included.

As of September 2026, on the Workers Paid plan ($5/month):

- **10 hours of browser time per month included**, then **$0.09 per additional hour**.
- **10 concurrent browsers included** (averaged over the month), then **$2.00 per additional
  browser**.

A sheet is one short render — call it a few seconds of browser time, so roughly a thousand
PDFs an hour of browser time. The included ten hours is a lot of sheets. What it is not proof
against is a script: with the limiter at five a minute, one address can spend about twenty
seconds of browser time a minute, and many addresses can spend proportionally more. If you
publish this somewhere busy, watch the Browser Rendering usage graph for the first week and
lower `simple.limit` if the shape of it surprises you.

The Workers Free plan gives ten minutes of browser time per day and allows one quick action
every ten seconds account-wide. Fine for trying it, useless for a real deployment.

Sources, all current as of this writing:

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
