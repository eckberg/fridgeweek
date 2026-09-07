import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against a real build, because the builder is a hydrated
 * island and its state lives in the URL: both only behave truthfully in a
 * browser.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    browserName: 'chromium',
    ...(process.env.CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    // The built server entry, not `astro preview`. It is the command
    // `docs/DEPLOYING.md` gives for a Node deployment, so the tests drive the
    // artifact that actually ships, and it stays in the foreground. `astro
    // preview` does not: since 7.2 it detaches into the background whenever it
    // detects an AI agent environment, and a server that forks away is one
    // Playwright reports as having exited early.
    command: 'pnpm build && node dist/server/entry.mjs',
    url: 'http://localhost:4321',
    env: { PORT: '4321' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
