import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  // The same build-time constant `astro.config.mjs` defines. Tests run against
  // the Node shape of the code, which is the one the default deployment uses.
  define: { __DEPLOY_TARGET__: JSON.stringify('node') },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
