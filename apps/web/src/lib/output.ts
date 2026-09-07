/**
 * Getting a sheet off the screen and onto paper.
 *
 * Printing happens entirely in the browser: the complete document produced by
 * `@fridgeweek/core` is written into a hidden iframe and printed from there, so
 * the page's own chrome cannot leak into the output and `@page` rules apply to
 * the sheet rather than to the site.
 *
 * The PDF endpoint is optional. When a deployment has no PDF renderer the
 * button says so and printing remains the way through, which every browser can
 * save as a PDF anyway.
 */

const PRINT_FRAME_ID = 'fridgeweek-print-frame';

/** Writes the document into a hidden iframe and opens the print dialog. */
export async function printDocument(html: string): Promise<void> {
  const frame = getPrintFrame();
  await writeToFrame(frame, html);

  const view = frame.contentWindow;
  if (!view) throw new Error('The print frame did not initialise.');

  // Fonts must be in before printing or the first page can render in a fallback.
  await view.document.fonts?.ready;
  view.focus();
  view.print();
}

/** Offers the standalone HTML document as a download. */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(URL.createObjectURL(blob), filename, true);
}

export interface PdfResult {
  ok: boolean;
  /** Set when the endpoint is absent or refused; the caller shows it. */
  reason?: 'unavailable' | 'limited' | 'failed';
}

/** Asks the server to render a PDF. Returns rather than throws, so the UI can explain. */
export async function downloadPdf(
  config: unknown,
  filename: string,
  endpoint = '/api/pdf',
): Promise<PdfResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    });
  } catch {
    return { ok: false, reason: 'failed' };
  }

  if (response.status === 404 || response.status === 501) {
    return { ok: false, reason: 'unavailable' };
  }
  // A hosted renderer costs its owner money and rate-limits accordingly. That
  // is a "wait a moment", not a failure, and printing is unaffected.
  if (response.status === 429) return { ok: false, reason: 'limited' };
  if (!response.ok) return { ok: false, reason: 'failed' };

  const blob = await response.blob();
  triggerDownload(URL.createObjectURL(blob), filename, true);
  return { ok: true };
}

export function sheetFilename(extension: string, weekStarting?: string): string {
  const suffix = weekStarting ? `-${weekStarting}` : '';
  return `fridgeweek${suffix}.${extension}`;
}

function getPrintFrame(): HTMLIFrameElement {
  const existing = document.getElementById(PRINT_FRAME_ID);
  if (existing instanceof HTMLIFrameElement) return existing;

  const frame = document.createElement('iframe');
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.title = 'Print frame';
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });
  document.body.appendChild(frame);
  return frame;
}

function writeToFrame(frame: HTMLIFrameElement, html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The sheet took too long to render.')), 10_000);
    frame.addEventListener(
      'load',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    frame.srcdoc = html;
  });
}

function triggerDownload(url: string, filename: string, revoke: boolean): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
