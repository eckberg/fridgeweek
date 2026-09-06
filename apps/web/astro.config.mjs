import node from '@astrojs/node';
import vue from '@astrojs/vue';
import { defineConfig } from 'astro/config';

/**
 * Static by default: every page is prerendered and can be served from any file
 * host. The one exception is `/api/pdf`, which opts out of prerendering.
 *
 * The Node adapter is what makes that route runnable locally with no account
 * and no hosting platform. A deployment that only wants the static site can
 * delete the route and the adapter; printing from the browser is unaffected,
 * and that is the path most people take.
 */
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [vue()],
  server: { port: 4321 },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: { target: 'es2022' },
    // The PDF renderer imports Playwright at request time, on Node. It must stay
    // a runtime import so that a deployment without it simply has no renderer
    // rather than failing to build.
    ssr: { external: ['playwright-core'] },
  },
});
