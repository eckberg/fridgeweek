import { DEFAULT_CONFIG, LIMITS } from '@fridgeweek/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadPdf } from '../src/lib/output.js';
import { handlePdfRequest } from '../src/lib/pdf/handler.js';
import { isWithinRateLimit, MAX_PDF_PAGES, rateLimitKey } from '../src/lib/pdf/limits.js';
import { type PdfRenderer, resolveRenderer, setRenderer } from '../src/lib/pdf/renderer.js';
import type { RuntimeEnv } from '../src/lib/pdf/runtime.js';

/**
 * The Cloudflare deployment cannot be exercised from here: there is no workerd
 * and no account. What can be exercised is everything around the bindings —
 * the page cap, the limiter's two answers, the key the limiter is asked about,
 * and which renderer gets chosen — so all of that is done against fakes with
 * the shape the real bindings have.
 */

/** A limiter binding that always answers the same way, and records its keys. */
function fakeLimiter(success: boolean) {
  const keys: string[] = [];
  return {
    keys,
    limit: async ({ key }: { key: string }) => {
      keys.push(key);
      return { success };
    },
  };
}

function fakeRenderer(): PdfRenderer & { calls: number } {
  return {
    name: 'fake',
    calls: 0,
    async render() {
      this.calls++;
      return new TextEncoder().encode('%PDF-1.4 fake');
    },
  };
}

function postConfig(config: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://fridgeweek.test/api/pdf', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(config),
  });
}

afterEach(() => {
  setRenderer(undefined);
  vi.restoreAllMocks();
});

describe('the page cap', () => {
  it('is the same number the configuration schema enforces', () => {
    expect(MAX_PDF_PAGES).toBe(LIMITS.weeks.max);
    expect(MAX_PDF_PAGES).toBe(25);
  });

  it('renders a request for exactly the cap', async () => {
    const renderer = fakeRenderer();
    setRenderer(renderer);

    const response = await handlePdfRequest(
      postConfig({ ...DEFAULT_CONFIG, weekStarting: '2026-09-07', weeks: MAX_PDF_PAGES }),
      null,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(renderer.calls).toBe(1);
  });

  it('refuses one page more with 422 and never reaches the renderer', async () => {
    const renderer = fakeRenderer();
    setRenderer(renderer);

    const response = await handlePdfRequest(
      postConfig({ ...DEFAULT_CONFIG, weekStarting: '2026-09-07', weeks: MAX_PDF_PAGES + 1 }),
      null,
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.issues?.[0]?.path).toBe('weeks');
    expect(renderer.calls).toBe(0);
  });

  it('is enforced by the endpoint even if the schema stops enforcing it', async () => {
    // The guard exists precisely so that a change in `@fridgeweek/core` cannot
    // quietly uncap this endpoint, so the test pretends that change happened.
    const renderer = fakeRenderer();
    setRenderer(renderer);
    const core = await import('@fridgeweek/core');
    vi.spyOn(core, 'validateConfig').mockReturnValue({
      ok: true,
      config: { ...DEFAULT_CONFIG, weekStarting: '2026-09-07', weeks: 500 },
    });

    const response = await handlePdfRequest(postConfig({ weeks: 500 }), null);

    expect(response.status).toBe(422);
    expect(renderer.calls).toBe(0);
  });
});

describe('rate limiting', () => {
  it('lets a request through when the limiter says yes', async () => {
    const renderer = fakeRenderer();
    setRenderer(renderer);
    const limiter = fakeLimiter(true);

    const response = await handlePdfRequest(
      postConfig(DEFAULT_CONFIG, { 'cf-connecting-ip': '203.0.113.7' }),
      { PDF_RATE_LIMITER: limiter } as unknown as RuntimeEnv,
    );

    expect(response.status).toBe(200);
    expect(limiter.keys).toEqual(['203.0.113.7']);
  });

  it('answers 429 with Retry-After and the usual problem shape when it says no', async () => {
    const renderer = fakeRenderer();
    setRenderer(renderer);

    const response = await handlePdfRequest(
      postConfig(DEFAULT_CONFIG, { 'cf-connecting-ip': '203.0.113.7' }),
      { PDF_RATE_LIMITER: fakeLimiter(false) } as unknown as RuntimeEnv,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('content-type')).toBe('application/json');
    const body = await response.json();
    expect(body.status).toBe(429);
    expect(body.detail).toMatch(/print from your browser/i);
    // Refused before any rendering work, which is the whole point.
    expect(renderer.calls).toBe(0);
  });

  it('allows everything when there is no limiter binding', async () => {
    expect(await isWithinRateLimit(undefined, new Headers())).toBe(true);
  });

  it('refuses when the limiter itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      limit: async () => {
        throw new Error('binding unavailable');
      },
    };

    expect(await isWithinRateLimit(broken, new Headers())).toBe(false);
  });
});

describe('what the button makes of a refusal', () => {
  it('tells a rate-limited visitor to wait rather than that it failed', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } }),
    );
    expect(await downloadPdf({}, 'sheet.pdf')).toEqual({ ok: false, reason: 'limited' });
    vi.unstubAllGlobals();
  });

  it('still reads 501 as "this deployment has no renderer"', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 501 }));
    expect(await downloadPdf({}, 'sheet.pdf')).toEqual({ ok: false, reason: 'unavailable' });
    vi.unstubAllGlobals();
  });
});

describe('the rate limit key', () => {
  it('prefers the address the Cloudflare edge saw', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.1',
    });
    expect(rateLimitKey(headers)).toBe('203.0.113.7');
  });

  it('takes the first entry of a forwarding chain', () => {
    const headers = new Headers({ 'x-forwarded-for': ' 198.51.100.1 , 203.0.113.9 ' });
    expect(rateLimitKey(headers)).toBe('198.51.100.1');
  });

  it('falls back to x-real-ip, then to a single shared bucket', () => {
    expect(rateLimitKey(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(rateLimitKey(new Headers())).toBe('unknown');
  });
});

describe('renderer resolution', () => {
  it('builds a Cloudflare renderer around a browser binding, without caching it', async () => {
    const browser = { quickAction: async () => new Response('') };
    const env = { BROWSER: browser } as unknown as RuntimeEnv;

    const first = await resolveRenderer(env);
    const second = await resolveRenderer(env);

    expect(first?.name).toBe('cloudflare-browser-rendering');
    // A binding is request-scoped, so the renderer around it must not be
    // remembered between requests.
    expect(second).not.toBe(first);
    // And an environment without the binding must not inherit it.
    expect((await resolveRenderer(null))?.name).not.toBe('cloudflare-browser-rendering');
  });

  it('falls back to the local renderer when no binding is present', async () => {
    const renderer = await resolveRenderer(null);
    // Playwright is a dev dependency; where it is missing there is no renderer
    // at all, which is the supported "print instead" configuration.
    expect(renderer === null || renderer.name === 'local-chromium').toBe(true);
  });

  it('answers 501 when nothing can render', async () => {
    setRenderer(null);
    const response = await handlePdfRequest(postConfig(DEFAULT_CONFIG), null);
    expect(response.status).toBe(501);
    expect((await response.json()).detail).toMatch(/print from your browser/i);
  });
});
