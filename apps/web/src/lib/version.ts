import pkg from '../../package.json';

/**
 * The version printed in the footer, and the one a release is tagged with.
 *
 * It lives in `apps/web/package.json` because the website is what gets
 * released: `packages/core` is a workspace package that is never published, so
 * its own version is inert, and the repository root is a container rather than
 * a thing with a version. One number, in the file a version normally lives in.
 *
 * Imported only by components rendered at build time, so the manifest never
 * reaches the browser.
 */
export const SITE_VERSION: string = pkg.version;
