/**
 * Turning a sheet document into a PDF.
 *
 * The site works with no renderer at all: printing from the browser produces
 * the same pages, and every browser can save that as a PDF. A renderer only
 * exists so that one button does it in a single step, and so that the file is
 * byte-identical whichever browser asked for it.
 *
 * Implementations are chosen at request time by `resolveRenderer`. If none is
 * available the endpoint answers 501 and the interface tells people to print
 * instead, which is a complete answer rather than an error.
 */

import { createCloudflareRenderer } from './cloudflare.js';
import type { RuntimeEnv } from './runtime.js';

export interface PdfPage {
  /** Paper width in millimetres. */
  widthMm: number;
  heightMm: number;
}

export interface PdfRenderer {
  readonly name: string;
  /**
   * Renders a complete, self-contained HTML document to PDF bytes. The
   * document already carries its own `@page` size, so the renderer must honour
   * the CSS page size rather than imposing its own.
   */
  render(html: string, page: PdfPage): Promise<Uint8Array>;
  /** Releases any browser or connection held open between requests. */
  dispose?(): Promise<void>;
}

export class RendererUnavailableError extends Error {
  constructor(reason: string) {
    super(`No PDF renderer is available: ${reason}`);
    this.name = 'RendererUnavailableError';
  }
}

let cachedLocal: PdfRenderer | null | undefined;
let override: PdfRenderer | null | undefined;

/**
 * Finds a renderer for this request.
 *
 * The Worker environment has to be passed in rather than looked up, because a
 * binding belongs to the request it arrived with. So the hosted renderer is
 * built fresh every time and nothing about it is kept in module state.
 *
 * Local development uses the Chromium that Playwright installs, which needs no
 * account, no key and no network. That one *is* cached: launching Chromium
 * costs about a second, and the process it lives in outlives the request.
 */
export async function resolveRenderer(env?: RuntimeEnv | null): Promise<PdfRenderer | null> {
  if (override !== undefined) return override;

  const browser = env?.BROWSER;
  if (browser) return createCloudflareRenderer(browser);

  // Playwright cannot run in a Worker and must not be bundled into one. The
  // constant is replaced at build time, so this whole branch — and with it the
  // import of `playwright-core` — is dropped from a Cloudflare build.
  if (__DEPLOY_TARGET__ === 'cloudflare') return null;

  if (cachedLocal === undefined) cachedLocal = await loadLocalRenderer();
  return cachedLocal;
}

async function loadLocalRenderer(): Promise<PdfRenderer | null> {
  try {
    const { createLocalRenderer } = await import('./local.js');
    return await createLocalRenderer();
  } catch {
    // Playwright is a development dependency, so a deployment that does not
    // install it simply has no renderer. That is a supported configuration.
    return null;
  }
}

/**
 * Test seam: forces the renderer every caller gets, or clears the forcing with
 * `undefined`. `null` means "this deployment has no renderer", which is what
 * the 501 answer is made of.
 */
export function setRenderer(renderer: PdfRenderer | null | undefined): void {
  override = renderer;
  if (renderer === undefined) cachedLocal = undefined;
}
