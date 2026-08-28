/**
 * Guarded access to browser APIs.
 *
 * The SDK runs on sites it does not control, in browsers it cannot predict — private modes
 * that make `localStorage` *throw* on access rather than return null, embedded webviews with
 * no `crypto`, pages with a Content-Security-Policy that blocks its requests. Every capability
 * it depends on is reached through this module, so "the browser said no" is handled in one
 * place instead of being scattered through the code as try/catch noise.
 *
 * Nothing here throws. A missing capability is reported as `null`, and callers degrade.
 */

/** A storage backend the SDK can use. Matches the shape of `Storage` without requiring it. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Returns a working storage, or null.
 *
 * A read-write probe is used rather than a truthiness check: Safari in private browsing
 * exposes `localStorage` and then throws `QuotaExceededError` on the first write, so an
 * object that merely exists proves nothing.
 */
function probe(get: () => Storage | undefined): KeyValueStore | null {
  try {
    const store = get();
    if (!store) return null;
    const key = "__routely_probe__";
    store.setItem(key, "1");
    store.removeItem(key);
    return store;
  } catch {
    return null;
  }
}

export function getLocalStorage(): KeyValueStore | null {
  return probe(() => (typeof window === "undefined" ? undefined : window.localStorage));
}

export function getSessionStorage(): KeyValueStore | null {
  return probe(() => (typeof window === "undefined" ? undefined : window.sessionStorage));
}

/**
 * An in-memory store, used when every persistent option is unavailable.
 *
 * The visitor is then effectively new on each page load. That is a real loss of accuracy, but
 * it is the correct trade: refusing to run at all would be worse for the customer, and
 * inventing a fingerprint to compensate would be worse for the visitor.
 */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** Cookie access as a `KeyValueStore`, so it can stand in for storage without special-casing. */
export function createCookieStore(maxAgeSeconds: number): KeyValueStore | null {
  if (typeof document === "undefined") return null;

  return {
    getItem(key) {
      const match = document.cookie.match(
        new RegExp(`(?:^|; )${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
      );
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    },
    setItem(key, value) {
      // `SameSite=Lax` keeps the id off cross-site requests; `Secure` is added only on HTTPS
      // because a Secure cookie is silently dropped on an http:// development site.
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie =
        `${key}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax` +
        secure;
    },
    removeItem(key) {
      document.cookie = `${key}=; Max-Age=0; Path=/`;
    },
  };
}

/**
 * A random identifier, using the strongest source the browser offers.
 *
 * `crypto.randomUUID` needs a secure context, so plain-http sites fall back to
 * `getRandomValues`, and the last resort is `Math.random`. That last one is not
 * cryptographically random — acceptable only because this value identifies nothing and grants
 * nothing; it is a bucket label, and a collision costs one miscounted visitor.
 */
export function randomId(): string {
  const cryptoApi = typeof crypto !== "undefined" ? crypto : undefined;

  if (cryptoApi?.randomUUID) {
    try {
      return cryptoApi.randomUUID();
    } catch {
      // Fall through.
    }
  }

  const bytes = new Uint8Array(16);

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 version and variant bits, so the value is a well-formed v4 UUID either way.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    hex.push((bytes[i] as number).toString(16).padStart(2, "0"));
  }

  return (
    `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-` +
    `${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
  );
}
