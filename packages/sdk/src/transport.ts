/**
 * Network access.
 *
 * Every function here resolves — never rejects. A tracking script that throws into a host
 * page's console, or leaves an unhandled rejection behind, is a bug report for the customer
 * about software they did not write. A failed request means "no configuration", and the SDK
 * treats that the same as "no experiments": it does nothing.
 */

/** How long to wait before abandoning a request. */
export const DEFAULT_TIMEOUT_MS = 3000;

export async function getJson<T>(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
  if (typeof fetch !== "function") return null;

  // An abort is what keeps a hung request from holding a connection open for the life of the
  // page; `fetch` has no timeout of its own.
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(url, {
      method: "GET",
      // No credentials: the endpoint is public and must never receive the customer's cookies.
      credentials: "omit",
      mode: "cors",
      cache: "default",
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
