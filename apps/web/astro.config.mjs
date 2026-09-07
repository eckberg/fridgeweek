import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import { defineConfig } from 'astro/config';

/**
 * Static by default: every page is prerendered and can be served from any file
 * host. The one exception is `/api/pdf`, which opts out of prerendering.
 *
 * The Node adapter is what makes that route runnable locally with no account
 * and no hosting platform, and it is what `dev`, `build`, `preview` and the
 * end-to-end tests all use. A deployment that only wants the static site can
 * delete the route and the adapter; printing from the browser is unaffected,
 * and that is the path most people take.
 *
 * `DEPLOY_TARGET=cloudflare` swaps in the Cloudflare adapter, for a deployment
 * that renders PDFs with Browser Rendering instead of a local Chromium. Both
 * adapters are installed; exactly one is active per build, and the default is
 * unchanged by the existence of the other. See `docs/DEPLOYING.md`.
 */
const target = process.env.DEPLOY_TARGET === 'cloudflare' ? 'cloudflare' : 'node';

const cloudflare = target === 'cloudflare' ? (await import('@astrojs/cloudflare')).default : null;

export default defineConfig({
  // The canonical origin. Absolute URLs in the sitemap, the canonical link and
  // the social card are all derived from it, so it has to be set even though
  // every page is otherwise origin-agnostic.
  site: 'https://fridgeweek.com',
  output: 'static',
  adapter: cloudflare
    ? // `passthrough` keeps the Cloudflare Images binding out of the deployment.
      // The site has no raster images to optimise, and Browser Rendering is
      // meant to be the only billable thing here.
      cloudflare({ imageService: 'passthrough' })
    : node({ mode: 'standalone' }),
  // Astro's Cloudflare adapter provisions a KV namespace for sessions unless
  // told not to. This site has no sessions and no server-side state of any
  // kind, and the point of the Cloudflare path is that it needs no storage
  // product at all.
  ...(cloudflare ? { session: false } : {}),
  integrations: [
    vue(),
    // `/api/pdf` is the one route that is not a page; it has nothing to index.
    sitemap({ filter: (page) => !page.includes('/api/') }),
  ],
  server: { port: 4321 },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: { target: 'es2022' },
    // Replaced with a literal so that dead branches are dropped rather than
    // bundled: the Worker must not carry Playwright, and the Node build must
    // not carry an import of `cloudflare:workers`.
    define: { __DEPLOY_TARGET__: JSON.stringify(target) },
    // The PDF renderer imports Playwright at request time, on Node. It must stay
    // a runtime import so that a deployment without it simply has no renderer
    // rather than failing to build. `cloudflare:workers` is a workerd built-in
    // and is never something a bundler should try to resolve.
    ssr: { external: ['playwright-core', 'cloudflare:workers'] },
  },
});
