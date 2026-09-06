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

let cached: PdfRenderer | null | undefined;

/**
 * Finds a renderer for this deployment, once per process.
 *
 * Local development uses the Chromium that Playwright installs, which needs no
 * account, no key and no network. A hosted deployment would add its own
 * implementation here; see `cloudflare.ts` for the shape that would take.
 */
export async function resolveRenderer(): Promise<PdfRenderer | null> {
  if (cached !== undefined) return cached;
  cached = await loadLocalRenderer();
  return cached;
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

/** Test seam: lets a test install a fake renderer or clear the cache. */
export function setRenderer(renderer: PdfRenderer | null | undefined): void {
  cached = renderer;
}
