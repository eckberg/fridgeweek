import { describe, expect, it } from 'vitest';
import { SITE_VERSION } from '../src/lib/version.js';

/**
 * The footer prints this and a release is tagged after it, so a wrong value is
 * wrong in two places at once and visible on every page.
 */
describe('SITE_VERSION', () => {
  it('is a release version', () => {
    expect(SITE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is the website’s own version, not the workspace root placeholder', () => {
    expect(SITE_VERSION).not.toBe('0.0.0');
  });
});
