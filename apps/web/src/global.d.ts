/**
 * Which deployment this bundle was built for, replaced with a literal by Vite
 * (see `astro.config.mjs`). It is a build-time constant rather than an
 * environment variable so that the branches it guards can be removed from the
 * bundle: a Worker must not contain a reference to Playwright, and a Node
 * bundle must not contain one to `cloudflare:workers`.
 */
declare const __DEPLOY_TARGET__: 'node' | 'cloudflare';

/**
 * The Worker environment, available only inside workerd. The real declaration
 * lives in `@cloudflare/workers-types`, which cannot be pulled in globally here
 * because its DOM-shaped globals collide with Astro's. Only the one binding
 * accessor this project uses is declared, and the caller gives it a type.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
