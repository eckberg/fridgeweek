/**
 * Shared helper for reading icon bodies out of the `lucide-static` package.
 *
 * Used by `scripts/build-icons.ts` to generate `src/symbols/lucide.generated.ts`
 * and by `test/symbols.test.ts` to assert that the generated file is in sync.
 * Node-only: never imported from `src/`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const requireFrom = createRequire(import.meta.url);

/** Absolute path to the installed `lucide-static` package root. */
export function lucideRoot(): string {
  return dirname(requireFrom.resolve('lucide-static/package.json'));
}

/** Version of the installed `lucide-static` package. */
export function lucideVersion(): string {
  const pkg = JSON.parse(readFileSync(join(lucideRoot(), 'package.json'), 'utf8')) as {
    version?: unknown;
  };
  if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
    throw new Error('lucide-static/package.json has no version');
  }
  return pkg.version;
}

/**
 * Takes the source of a Lucide SVG file and returns the inner markup of its
 * `<svg>` element with all whitespace between elements removed.
 */
export function extractLucideBody(svg: string, id: string): string {
  const open = svg.indexOf('<svg');
  if (open === -1) throw new Error(`${id}: no <svg> element`);
  const contentStart = svg.indexOf('>', open);
  if (contentStart === -1) throw new Error(`${id}: unterminated <svg> tag`);
  const close = svg.lastIndexOf('</svg>');
  if (close === -1 || close < contentStart) throw new Error(`${id}: no </svg> element`);

  const body = svg
    .slice(contentStart + 1, close)
    .replace(/>\s+</g, '><')
    .trim();
  if (body.length === 0) throw new Error(`${id}: empty icon body`);
  if (body.includes('<svg')) throw new Error(`${id}: nested <svg> element`);
  return body;
}

/** Reads one icon from the installed `lucide-static` package. Throws if missing. */
export function readLucideBody(id: string, root = lucideRoot()): string {
  const file = join(root, 'icons', `${id}.svg`);
  let svg: string;
  try {
    svg = readFileSync(file, 'utf8');
  } catch (cause) {
    throw new Error(`lucide icon '${id}' not found at ${file}`, { cause });
  }
  return extractLucideBody(svg, id);
}

/** Reads every id and returns them keyed by id, sorted alphabetically. */
export function readLucideBodies(ids: readonly string[]): Record<string, string> {
  const root = lucideRoot();
  const out: Record<string, string> = {};
  for (const id of [...ids].sort()) {
    out[id] = readLucideBody(id, root);
  }
  return out;
}
