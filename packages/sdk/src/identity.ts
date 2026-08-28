import {
  type KeyValueStore,
  createCookieStore,
  createMemoryStore,
  getLocalStorage,
  randomId,
} from "./env";

/**
 * Anonymous visitor identity.
 *
 * The id is a random UUID with no derivation from anything about the person: no IP, no user
 * agent, no fingerprint. It exists to answer one question — "have I seen this browser on this
 * site before?" — so that a visitor keeps the same experience across visits. It cannot
 * identify anyone, and it is scoped to the customer's own origin by the storage it lives in.
 */

/** Key used in whichever store backs the identity. */
export const VISITOR_ID_KEY = "routely_vid";

/** A year. Long enough that an experiment outlives it only in unusual cases. */
export const VISITOR_ID_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Bounds matching the ingestion API's validation, so a stored value is never silently rejected. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;
const VALID = /^[A-Za-z0-9_-]+$/;

export type IdentitySource = "local-storage" | "cookie" | "memory";

export interface Identity {
  id: string;
  /** True when this page load minted the id, rather than reading an existing one. */
  isNew: boolean;
  /** Which backend the id came from. Reported in debug output when diagnosing an install. */
  source: IdentitySource;
}

/**
 * Rejects a stored value that could not have come from this SDK.
 *
 * Storage is shared with the host page, which may write anything under any key, and the value
 * is sent to the API — where a malformed id would be rejected and the event silently lost. A
 * bad value is discarded and replaced rather than trusted.
 */
export function isValidVisitorId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= MIN_LENGTH &&
    value.length <= MAX_LENGTH &&
    VALID.test(value)
  );
}

/**
 * The storage backends, in order of preference.
 *
 * `localStorage` first because it survives browser restarts and is not sent with every HTTP
 * request. A cookie second, for the browsers and privacy modes where storage throws. Memory
 * last, so the SDK still functions — for the duration of one page load — when both are denied.
 */
export function resolveStores(): { store: KeyValueStore; source: IdentitySource }[] {
  const stores: { store: KeyValueStore; source: IdentitySource }[] = [];

  const local = getLocalStorage();
  if (local) stores.push({ store: local, source: "local-storage" });

  const cookie = createCookieStore(VISITOR_ID_MAX_AGE_SECONDS);
  if (cookie) stores.push({ store: cookie, source: "cookie" });

  stores.push({ store: createMemoryStore(), source: "memory" });
  return stores;
}

/**
 * Returns the visitor's id, creating and persisting one if needed.
 *
 * Whichever store the id is found in, it is written back to *all* of them. That heals the
 * common asymmetry where a cookie survives but `localStorage` was cleared, and it means a
 * visitor is not re-bucketed just because their browser dropped one storage mechanism.
 */
export function resolveIdentity(
  stores: { store: KeyValueStore; source: IdentitySource }[] = resolveStores(),
  options: { preferred?: string | null } = {},
): Identity {
  for (const { store, source } of stores) {
    let existing: string | null = null;

    try {
      existing = store.getItem(VISITOR_ID_KEY);
    } catch {
      continue;
    }

    if (isValidVisitorId(existing)) {
      persist(existing, stores);
      return { id: existing, isNew: false, source };
    }
  }

  // A redirect hands the visitor id across an origin boundary in the URL, where storage from
  // the previous origin is unreachable. Adopting it — only when nothing is stored, never over
  // an existing id — is what stops one visitor becoming two at the moment of redirect.
  //
  // The value is attacker-controllable, which is acceptable because it confers nothing: the id
  // identifies no one and grants no access. The worst a crafted link achieves is choosing the
  // id for its own click.
  const id = isValidVisitorId(options.preferred) ? options.preferred : randomId();

  // The source is where the id actually landed, not where it was first attempted: a store can
  // exist and still reject the write, and reporting one that refused would send whoever is
  // debugging an installation after the wrong mechanism.
  return { id, isNew: true, source: persist(id, stores) ?? "memory" };
}

/**
 * Writes the id to every available store, ignoring the ones that refuse.
 * Returns the source of the first store that accepted it, or null if none did.
 */
function persist(
  id: string,
  stores: { store: KeyValueStore; source: IdentitySource }[],
): IdentitySource | null {
  let first: IdentitySource | null = null;

  for (const { store, source } of stores) {
    try {
      store.setItem(VISITOR_ID_KEY, id);
      first ??= source;
    } catch {
      // A full or read-only store is not a reason to stop trying the others.
    }
  }

  return first;
}
