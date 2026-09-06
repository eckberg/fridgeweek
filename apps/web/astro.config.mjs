import vue from '@astrojs/vue';
import { defineConfig } from 'astro/config';

/**
 * Static by default: the whole site can be served from any file host, and the
 * only server route is the optional PDF endpoint. See docs/PDF.md.
 */
export default defineConfig({
  output: 'static',
  integrations: [vue()],
  server: { port: 4321 },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: { target: 'es2022' },
  },
});
