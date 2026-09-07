import type { BrowserRun } from '@cloudflare/workers-types';
import type { PdfPage, PdfRenderer } from './renderer.js';

/**
 * Renders with Cloudflare Browser Rendering, from inside the Worker.
 *
 * This is the hosted counterpart to `local.ts`. It exists so that a deployment
 * with no machine of its own can still hand out a PDF; printing from the
 * browser remains the free path and needs none of this.
 *
 * The `pdf` quick action is used rather than a Puppeteer session: the whole job
 * is "one document in, one PDF out", it needs no navigation, no clicks and no
 * session kept alive, and it keeps `@cloudflare/puppeteer` out of the Worker
 * bundle. Quick actions need a `compatibility_date` of 2026-03-24 or later.
 *
 * @see https://developers.cloudflare.com/browser-rendering/quick-actions/pdf-endpoint/
 */
export function createCloudflareRenderer(browser: BrowserRun): PdfRenderer {
  return {
    name: 'cloudflare-browser-rendering',

    async render(html: string, page: PdfPage): Promise<Uint8Array> {
      const response = await browser.quickAction('pdf', {
        // The document goes over as HTML, never as a URL: a sheet is a
        // configuration nobody has published, and rendering the bytes we
        // already hold is the only way the PDF is guaranteed to be the
        // document the browser previewed.
        html,
        pdfOptions: {
          // The same three settings as `local.ts`, for the same reason: the
          // document declares its own `@page` size, so honour it and add no
          // margins of the renderer's own.
          preferCSSPageSize: true,
          printBackground: true,
          width: `${page.widthMm}mm`,
          height: `${page.heightMm}mm`,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      });

      if (!response.ok) {
        // The quick action answers with a JSON error body on failure. It is
        // small, and it is the only clue about what went wrong up there.
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Browser Rendering answered ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        );
      }

      return new Uint8Array(await response.arrayBuffer());
    },

    // No `dispose`: the binding holds no browser open between requests. A
    // quick action starts one, renders, and bills the milliseconds it used.
  };
}
