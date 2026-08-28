import "server-only";

/**
 * In-memory rate limiting for the public ingestion endpoints.
 *
 * A fixed-window counter, deliberately: it is a few lines, allocates one small object per
 * active key, and needs no external service. The known weakness — up to 2× the limit across a
 * window boundary — is irrelevant here, because the goal is to stop a runaway loop or a naive
 * flood, not to meter a paid API.
 *
 * **This is per-process.** With more than one container the effective limit multiplies by the
 * number of instances. That is an accepted MVP trade: the alternative is a Redis dependency
 * for a protection that currently guards against accidents more than adversaries. Moving to a
 * shared store is a change to this file alone.
 */

interface Window {
  count: number;
  /** Epoch milliseconds at which this window resets. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/**
 * Cap on tracked keys, so a flood of distinct IPs cannot grow the map without bound — the
 * limiter itself would otherwise become the denial of service.
 */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets. Sent as `Retry-After`. */
  retryAfter: number;
}

/**
 * Removes expired entries, and if the map is still oversized, clears it entirely.
 *
 * Wholesale clearing is the right response to an overflow: it briefly forgives everyone, which
 * is far better than the alternative of unbounded memory growth, and it cannot be exploited
 * for more than one window.
 */
function evict(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  if (windows.size > MAX_KEYS) windows.clear();
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_KEYS) evict(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

/** Test seam: forget all state. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * The client address, as seen through the Nginx reverse proxy.
 *
 * `X-Forwarded-For` is trivially forgeable by a client, so only the **first** entry is used and
 * only because the proxy in front of this app rewrites the header. Exposing the app directly
 * to the internet would make this value meaningless — which is why the deployment puts nginx
 * in front and does not publish the app's port.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
