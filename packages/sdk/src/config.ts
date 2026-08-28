import type { ConfigResponse, ExperimentConfig } from "./contract";
import { SDK_PROTOCOL_VERSION } from "./contract";
import { type KeyValueStore, getSessionStorage } from "./env";
import { getJson } from "./transport";

/**
 * Experiment configuration for a website.
 *
 * Fetched from the public endpoint and cached in `sessionStorage`, so a visitor moving through
 * several pages makes one request rather than one per page. The cache is keyed by site id and
 * carries its own expiry, taken from the server's `ttl` — the server decides how stale a
 * browser may be, because it is the side that knows when an experiment was paused.
 */

const CACHE_PREFIX = "routely_cfg_";

/** Ceiling on a server-supplied TTL, so a bad value cannot pin a stale config for a session. */
const MAX_TTL_SECONDS = 600;

interface CachedConfig {
  /** Epoch milliseconds after which this entry must be refetched. */
  expiresAt: number;
  config: ConfigResponse;
}

/**
 * Confirms a payload is the shape this SDK understands before any of it is used.
 *
 * The response comes from the network, and an installation may outlive several deployments of
 * the API. Checking the protocol version and the field shapes here means a future server that
 * sends something new is ignored rather than half-interpreted by an old bundle.
 */
export function isConfigResponse(value: unknown): value is ConfigResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ConfigResponse>;

  return (
    candidate.v === SDK_PROTOCOL_VERSION &&
    typeof candidate.siteId === "string" &&
    Array.isArray(candidate.experiments) &&
    candidate.experiments.every(isExperimentConfig)
  );
}

function isExperimentConfig(value: unknown): value is ExperimentConfig {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ExperimentConfig>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.variantUrl === "string" &&
    typeof candidate.variantSplit === "number" &&
    typeof candidate.control?.url === "string" &&
    typeof candidate.goal?.url === "string"
  );
}

export function cacheKey(siteId: string): string {
  return CACHE_PREFIX + siteId;
}

/** Reads a cached config, ignoring anything expired, malformed, or from another protocol. */
export function readCachedConfig(
  siteId: string,
  store: KeyValueStore | null,
  now: number = Date.now(),
): ConfigResponse | null {
  if (!store) return null;

  try {
    const raw = store.getItem(cacheKey(siteId));
    if (!raw) return null;

    const entry = JSON.parse(raw) as Partial<CachedConfig>;
    if (typeof entry.expiresAt !== "number" || entry.expiresAt <= now) return null;
    if (!isConfigResponse(entry.config)) return null;

    return entry.config;
  } catch {
    return null;
  }
}

export function writeCachedConfig(
  siteId: string,
  config: ConfigResponse,
  store: KeyValueStore | null,
  now: number = Date.now(),
): void {
  if (!store) return;

  const ttl = Math.min(Math.max(config.ttl ?? 0, 0), MAX_TTL_SECONDS);

  try {
    const entry: CachedConfig = { expiresAt: now + ttl * 1000, config };
    store.setItem(cacheKey(siteId), JSON.stringify(entry));
  } catch {
    // A full or unavailable session store only costs an extra request per page.
  }
}

export function configUrl(apiBase: string, siteId: string): string {
  return `${apiBase}/api/v1/config?siteId=${encodeURIComponent(siteId)}`;
}

/**
 * Returns the site's configuration, from cache when it is fresh, otherwise from the network.
 * Resolves to `null` on any failure, which callers treat as "no experiments".
 */
export async function loadConfig(
  apiBase: string,
  siteId: string,
  timeoutMs?: number,
): Promise<ConfigResponse | null> {
  const store = getSessionStorage();

  const cached = readCachedConfig(siteId, store);
  if (cached) return cached;

  const fetched = await getJson<unknown>(configUrl(apiBase, siteId), timeoutMs);
  if (!isConfigResponse(fetched)) return null;

  writeCachedConfig(siteId, fetched, store);
  return fetched;
}
