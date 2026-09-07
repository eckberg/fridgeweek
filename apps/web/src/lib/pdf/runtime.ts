import type { BrowserRun, RateLimit } from '@cloudflare/workers-types';

/**
 * The Worker environment, as far as this endpoint cares about it.
 *
 * Both bindings are optional on purpose. The default deployment is the Node
 * adapter, where neither exists: the endpoint then renders with the local
 * Chromium and rate-limits nothing, exactly as it did before Cloudflare was an
 * option. A Cloudflare deployment that declares only one of the two also works;
 * see `wrangler.jsonc` for what each one is.
 */
export interface RuntimeEnv {
  /** Cloudflare Browser Rendering, used by `CloudflareBrowserRenderer`. */
  BROWSER?: BrowserRun;
  /** Cloudflare Rate Limiting, the only thing standing between the browser and a script. */
  PDF_RATE_LIMITER?: RateLimit;
}

/**
 * Finds the Worker environment, or `null` when there is not one.
 *
 * `@astrojs/cloudflare` v14 removed `Astro.locals.runtime.env`; the property is
 * still there but its getter throws, pointing at `cloudflare:workers` instead.
 * So the env comes from the module import, which is worker-global rather than
 * request-scoped and therefore safe to reach for at any point in a request.
 *
 * The import is behind a build-time constant so that it disappears from the
 * Node bundle entirely: `cloudflare:workers` only exists inside workerd, and a
 * Node build must not carry a reference to it.
 */
export async function resolveRuntimeEnv(): Promise<RuntimeEnv | null> {
  if (__DEPLOY_TARGET__ !== 'cloudflare') return null;
  try {
    const { env } = await import('cloudflare:workers');
    return env as RuntimeEnv;
  } catch {
    // A Cloudflare build running somewhere that is not workerd. There is no
    // environment, so there is no renderer, and the endpoint answers 501.
    return null;
  }
}
