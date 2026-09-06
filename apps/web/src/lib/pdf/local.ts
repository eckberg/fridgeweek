import type { PdfPage, PdfRenderer } from './renderer.js';

/**
 * Renders with the Chromium that Playwright installs. Intended for local
 * development and for anyone self-hosting on a machine they control: no
 * account, no API key, no network.
 *
 * The browser is started on first use and kept for the life of the process,
 * because launching Chromium costs about a second and rendering a sheet costs
 * a few tens of milliseconds.
 */
export async function createLocalRenderer(): Promise<PdfRenderer> {
  const { chromium } = await import('playwright-core');

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  async function getBrowser() {
    if (browser?.isConnected()) return browser;
    browser = await chromium.launch({
      // Set by environments that ship a browser at a known path.
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });
    return browser;
  }

  return {
    name: 'local-chromium',

    async render(html: string, page: PdfPage): Promise<Uint8Array> {
      const context = await (await getBrowser()).newContext();
      try {
        const tab = await context.newPage();
        await tab.setContent(html, { waitUntil: 'load' });
        await tab.evaluate(() => document.fonts.ready);
        return await tab.pdf({
          // The document declares its own @page size; honouring it keeps the
          // PDF identical to what the browser's own print dialog produces.
          preferCSSPageSize: true,
          printBackground: true,
          width: `${page.widthMm}mm`,
          height: `${page.heightMm}mm`,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
      } finally {
        await context.close();
      }
    },

    async dispose() {
      await browser?.close();
      browser = null;
    },
  };
}
