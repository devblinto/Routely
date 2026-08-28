/**
 * Named reporting windows.
 *
 * Ranges are resolved on the server from a short key in the URL rather than from client-sent
 * dates, so a bookmarked link means the same thing tomorrow as it does today, and there is no
 * way to ask for an unbounded or malformed window.
 */

export const RANGE_KEYS = ["all", "24h", "7d", "30d", "90d"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = "all";

export const RANGE_LABELS: Record<RangeKey, string> = {
  all: "All time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && (RANGE_KEYS as readonly string[]).includes(value);
}

/** Falls back to the default rather than erroring: a bad key in a URL is not worth a 400. */
export function parseRangeKey(value: unknown): RangeKey {
  return isRangeKey(value) ? value : DEFAULT_RANGE;
}

/**
 * Turns a key into the window the aggregation queries filter on.
 *
 * `all` resolves to `undefined`, which the repositories read as "no date filter at all" — a
 * cheaper query than one bounded by the epoch, and a clearer statement of intent.
 */
export function resolveRange(
  key: RangeKey,
  now: Date = new Date(),
): { from: Date; to: Date } | undefined {
  if (key === "all") return undefined;

  const to = now;
  const from = new Date(now.getTime() - RANGE_DAYS[key] * 24 * 60 * 60 * 1000);
  return { from, to };
}
