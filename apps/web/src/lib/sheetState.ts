import {
  ConfigError,
  type ConfigIssue,
  DEFAULT_CONFIG,
  decodeConfig,
  encodeConfig,
  resolveConfig,
  type SheetConfig,
} from '@fridgeweek/core';

/**
 * Where a sheet configuration lives.
 *
 * There is no server and no account, so the configuration itself is the
 * persistence layer. It is encoded into the URL hash, which makes every sheet a
 * shareable link, and mirrored into `localStorage` so that coming back to the
 * bare address restores your household instead of the defaults.
 *
 * The URL always wins: a link someone sends you must show their sheet, not
 * yours.
 */

const STORAGE_KEY = 'fridgeweek.config.v1';

export interface LoadResult {
  config: SheetConfig;
  /** How the configuration was found, for deciding whether to warn. */
  source: 'url' | 'storage' | 'defaults';
  /** Set when a link could not be read and the defaults were used instead. */
  issues?: ConfigIssue[];
}

export function readHash(hash: string): string | null {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  return value.length > 0 ? value : null;
}

/**
 * Resolves the configuration to start from. Never throws: a corrupt link or a
 * stale stored value falls back to the defaults and reports why.
 */
export function loadConfig(hash: string, storage: Pick<Storage, 'getItem'> | null): LoadResult {
  const encoded = readHash(hash);
  if (encoded) {
    try {
      return { config: decodeConfig(encoded), source: 'url' };
    } catch (error) {
      return {
        config: cloneDefaults(),
        source: 'defaults',
        issues: error instanceof ConfigError ? error.issues : [],
      };
    }
  }

  const stored = safeGet(storage, STORAGE_KEY);
  if (stored) {
    try {
      return { config: decodeConfig(stored), source: 'storage' };
    } catch {
      // A stored value from an older format is not worth complaining about.
    }
  }

  return { config: cloneDefaults(), source: 'defaults' };
}

/** Writes the configuration to the hash and to storage. */
export function saveConfig(config: SheetConfig, storage: Pick<Storage, 'setItem'> | null): string {
  const encoded = encodeConfig(config);
  safeSet(storage, STORAGE_KEY, encoded);
  return encoded;
}

export function shareUrl(origin: string, pathname: string, config: SheetConfig): string {
  return `${origin}${pathname}#${encodeConfig(config)}`;
}

export function cloneDefaults(): SheetConfig {
  return resolveConfig({
    ...DEFAULT_CONFIG,
    people: DEFAULT_CONFIG.people.map((person) => ({ ...person })),
  });
}

/**
 * Applies a partial change and validates the result. Returns the previous
 * configuration unchanged when the change would be invalid, so a control can
 * never put the sheet into a state the engine rejects.
 */
export function applyChange(
  current: SheetConfig,
  change: Partial<SheetConfig>,
): { config: SheetConfig; issues: ConfigIssue[] } {
  const candidate = { ...current, ...change };
  try {
    return { config: resolveConfig(stripUndefined(candidate)), issues: [] };
  } catch (error) {
    if (error instanceof ConfigError) return { config: current, issues: error.issues };
    throw error;
  }
}

/**
 * `resolveConfig` rejects unknown fields but accepts absent ones, and
 * `weekStarting` is cleared by removing it rather than by setting it to
 * undefined.
 */
function stripUndefined(config: SheetConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function safeGet(storage: Pick<Storage, 'getItem'> | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    // Private browsing and blocked site data both throw on access.
    return null;
  }
}

function safeSet(storage: Pick<Storage, 'setItem'> | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage being unavailable is not worth interrupting anyone over.
  }
}
