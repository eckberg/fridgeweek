/**
 * Importing this module makes every translation available to `t()`. English is
 * built into `index.ts` and is always the fallback, so a language that has not
 * covered a key yet still renders.
 *
 * Order follows `UI_LOCALES`.
 */
import { registerCatalogue } from './index.js';
import sv from './locales/sv.json';

registerCatalogue('sv', sv);
