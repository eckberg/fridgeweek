/**
 * A hosted renderer, sketched but not built.
 *
 * Fridgeweek deliberately runs with no account and no paid service, so this
 * file documents the shape a hosted implementation would take rather than
 * shipping one. Nothing imports it.
 *
 * Cloudflare's Browser Rendering binding can convert HTML to PDF from inside a
 * Worker. An implementation would:
 *
 *   1. Read the `BROWSER` binding from the request's runtime environment.
 *   2. Pass the document as `html` rather than as a URL, so no configuration
 *      has to be published to be rendered and the output is deterministic.
 *   3. Set `preferCSSPageSize` and `printBackground`, matching `local.ts`.
 *
 * Before it could be turned on, three things would have to be decided, because
 * a public endpoint that starts browsers is the only part of this project that
 * can cost real money:
 *
 *   - a per-IP rate limit,
 *   - a cap on `copies` lower than the one the configuration already enforces,
 *   - whether to put a challenge in front of the button.
 *
 * TODO(karl): decide the above before enabling a hosted renderer.
 */

export {};
