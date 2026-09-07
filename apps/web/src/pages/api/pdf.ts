import type { APIRoute } from 'astro';
import { handlePdfRequest, methodNotAllowed } from '../../lib/pdf/handler.js';
import { resolveRuntimeEnv } from '../../lib/pdf/runtime.js';

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
 *
 * This file is only the wiring. What the endpoint actually does lives in
 * `lib/pdf/handler.ts`, which takes a request and a Worker environment and can
 * therefore be tested without a server.
 */
export const prerender = false;

export const POST: APIRoute = async ({ request }) =>
  handlePdfRequest(request, await resolveRuntimeEnv());

/** Anything but POST, so a browser visiting the URL gets a useful answer. */
export const ALL: APIRoute = () => methodNotAllowed();
