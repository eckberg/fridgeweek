/**
 * Regenerates `src/fonts/fonts.generated.ts` from the WOFF2 files in
 * `assets/fonts/`. Run with `pnpm tsx scripts/build-fonts.ts` (or `pnpm generate`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_SUBSETS } from '../src/fonts/subsets.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontsDir = join(packageRoot, 'assets', 'fonts');
const outFile = join(packageRoot, 'src', 'fonts', 'fonts.generated.ts');

const entries = FONT_SUBSETS.map(({ subset, file, unicodeRange }) => {
  const path = join(fontsDir, file);
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (cause) {
    throw new Error(`font file missing: ${path}`, { cause });
  }
  if (bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`${path} is not a WOFF2 file (bad signature)`);
  }
  return { subset, unicodeRange, base64: bytes.toString('base64'), bytes: bytes.length };
});

const source = `// generated, do not edit
// see scripts/build-fonts.ts and assets/fonts/
// Atkinson Hyperlegible Next, SIL Open Font License 1.1, see assets/fonts/OFL.txt

export const FONT_FILES: readonly {
  subset: 'latin' | 'latin-ext';
  unicodeRange: string;
  base64: string;
}[] = [
${entries
  .map(
    ({ subset, unicodeRange, base64 }) =>
      `  {\n    subset: '${subset}',\n    unicodeRange: '${unicodeRange}',\n    base64:\n      '${base64}',\n  },`,
  )
  .join('\n')}
];
`;

writeFileSync(outFile, source, 'utf8');
console.log(
  `build-fonts: wrote ${entries.length} subsets (${entries
    .map((e) => `${e.subset} ${e.bytes}B`)
    .join(', ')})`,
);
