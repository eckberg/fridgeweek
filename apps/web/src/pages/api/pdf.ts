import { ConfigError, computeLayout, PAPER, renderSheet, validateConfig } from '@fridgeweek/core';
import type { APIRoute } from 'astro';
import { resolveRenderer } from '../../lib/pdf/renderer.js';

/**
 * Renders a sheet to PDF.
 *
 * The request body is a sheet configuration and nothing else: no identifiers,
 * no session, nothing that outlives the request. The configuration is
 * validated by the same function the browser uses, the document is built by
 * the same renderer, and the bytes are streamed back and forgotten.
 *
 * Deployments without a renderer answer 501, which the interface presents as
 * "print instead" rather than as a failure.
 */
export const prerender = false;

/** A sheet is a few kilobytes of JSON at most; anything larger is not one. */
const MAX_BODY_BYTES = 16 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return problem(415, 'Send application/json.');
  }

  // `content-length` is a claim, and a chunked request does not make one at
  // all, so the body is read with the cap applied as it arrives.
  let text: string;
  try {
    text = await readCapped(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return problem(413, 'That configuration is too large to be a sheet.');
    }
    return problem(400, 'The request body could not be read.');
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return problem(400, 'The request body was not valid JSON.');
  }

  const candidate =
    typeof body === 'object' && body !== null && 'config' in body
      ? (body as { config: unknown }).config
      : body;

  const result = validateConfig(candidate);
  if (!result.ok) {
    return problem(422, 'That configuration is not valid.', result.issues);
  }
  const config = result.config;

  // A configuration the engine cannot lay out would render an unusable sheet.
  const layout = computeLayout(config);
  const errors = layout.issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return problem(
      422,
      'That configuration does not fit on the paper.',
      errors.map((issue) => ({ path: issue.code, message: issue.message })),
    );
  }

  const renderer = await resolveRenderer();
  if (!renderer) {
    return problem(
      501,
      'This deployment has no PDF renderer. Print from your browser instead; every browser can save a printout as a PDF.',
    );
  }

  const paper = PAPER[config.paper];
  let pdf: Uint8Array;
  try {
    pdf = await renderer.render(renderSheet(config, { title: 'Fridgeweek' }), {
      widthMm: paper.width,
      heightMm: paper.height,
    });
  } catch (error) {
    if (error instanceof ConfigError) return problem(422, error.message);
    console.error('PDF rendering failed', error);
    return problem(502, 'The sheet could not be rendered. Print from your browser instead.');
  }

  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename(config.weekStarting)}"`,
      'content-length': String(pdf.byteLength),
      'cache-control': 'no-store',
    },
  });
};

/** Anything but POST, so a browser visiting the URL gets a useful answer. */
export const ALL: APIRoute = () =>
  problem(405, 'Send a POST with a sheet configuration as JSON.', undefined, {
    allow: 'POST',
  });

class BodyTooLargeError extends Error {}

/** Reads the body, refusing as soon as it goes past the cap. */
async function readCapped(request: Request, limit: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new BodyTooLargeError();
      chunks.push(value);
    }
  } finally {
    // Releasing the lock lets the connection be torn down promptly on refusal.
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

function filename(weekStarting: string | undefined): string {
  return weekStarting ? `fridgeweek-${weekStarting}.pdf` : 'fridgeweek.pdf';
}

function problem(
  status: number,
  detail: string,
  issues?: { path: string; message: string }[],
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ status, detail, ...(issues ? { issues } : {}) }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}
