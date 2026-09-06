import { defineConfig } from '@playwright/test';

/**
 * Visual regression of the rendered sheet. Run with `pnpm test:visual` after
 * `pnpm exec playwright install chromium`. Snapshots are committed for Linux
 * only, which is what CI runs.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: '../../test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.2 },
  },
  use: {
    browserName: 'chromium',
    deviceScaleFactor: 1,
    viewport: { width: 900, height: 1250 },
  },
});
