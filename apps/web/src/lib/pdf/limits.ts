import type { RateLimit } from '@cloudflare/workers-types';

/**
 * The two ceilings on a PDF request: how many pages one may ask for, and how
 * often one address may ask.
 */

/**
 * Pages per request.
 *
 * This is the same number as `LIMITS.copies.max` in `@fridgeweek/core`, and
 * deliberately so: one real limit, not two that can drift apart. The endpoint
 * checks it again anyway, because it validates untrusted input and should not
 * be left wide open by a change to the configuration schema.
 */
export const MAX_PDF_PAGES = 25;

/**
 * The window the limiter counts in, in seconds. It must match `simple.period`
 * in `wrangler.jsonc`; the binding does not report its own configuration, and
 * this number is what `Retry-After` promises.
 *
 * Cloudflare's Rate Limiting binding accepts a period of 10 or 60 seconds and
 * nothing else.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export const RATE_LIMIT_PERIOD_SECONDS = 60;

/**
 * Derives the limiter key from the request headers.
 *
 * On Cloudflare `CF-Connecting-IP` is set by the edge and cannot be forged by
 * the client, so it is the only header here that is trustworthy. The others are
 * a courtesy to anyone running this behind their own proxy; they can be spoofed,
 * which at worst spreads one client over several buckets.
 *
 * Everything with no address at all shares a single bucket. That is a
 * deliberate, blunt answer: it only happens where there is no Cloudflare edge,
 * and a deployment like that has no limiter binding to consult in the first
 * place.
 */
export function rateLimitKey(headers: Headers): string {
  const direct = headers.get('cf-connecting-ip')?.trim();
  if (direct) return direct;

  // `X-Forwarded-For` is a chain; the client is the first entry.
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;

  return 'unknown';
}

/**
 * Asks the limiter whether this request may proceed.
 *
 * With no limiter binding — local development, or a self-hosted deployment —
 * every request is allowed, which is how the endpoint has always behaved.
 *
 * A limiter that throws refuses the request. The limiter is the only thing
 * bounding what this endpoint can spend, so when it cannot answer, the safe
 * answer is no; printing from the browser is unaffected either way.
 */
export async function isWithinRateLimit(
  limiter: RateLimit | undefined,
  headers: Headers,
): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key: rateLimitKey(headers) });
    return success;
  } catch (error) {
    console.error('Rate limiter failed; refusing the request', error);
    return false;
  }
}
