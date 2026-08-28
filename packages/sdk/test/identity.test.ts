import { describe, expect, it } from "vitest";

import type { KeyValueStore } from "../src/env";
import { createMemoryStore, randomId } from "../src/env";
import {
  VISITOR_ID_KEY,
  type IdentitySource,
  isValidVisitorId,
  resolveIdentity,
} from "../src/identity";

/** A store that throws on every operation, like `localStorage` in Safari private browsing. */
function hostileStore(): KeyValueStore {
  return {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
}

function layered(...stores: { store: KeyValueStore; source: IdentitySource }[]) {
  return stores;
}

describe("randomId", () => {
  it("produces a well-formed v4 UUID", () => {
    expect(randomId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomId()));
    expect(ids.size).toBe(500);
  });

  it("produces ids the ingestion API accepts", () => {
    expect(isValidVisitorId(randomId())).toBe(true);
  });
});

describe("isValidVisitorId", () => {
  it("rejects values the API would refuse", () => {
    expect(isValidVisitorId("short")).toBe(false);
    expect(isValidVisitorId("x".repeat(65))).toBe(false);
    expect(isValidVisitorId("has spaces here")).toBe(false);
    expect(isValidVisitorId('"><script>')).toBe(false);
    expect(isValidVisitorId(null)).toBe(false);
    expect(isValidVisitorId(42)).toBe(false);
  });
});

describe("resolveIdentity", () => {
  it("mints and persists an id on a first visit", () => {
    const store = createMemoryStore();
    const identity = resolveIdentity(layered({ store, source: "local-storage" }));

    expect(identity.isNew).toBe(true);
    expect(store.getItem(VISITOR_ID_KEY)).toBe(identity.id);
  });

  it("returns the same id on a return visit", () => {
    const store = createMemoryStore();
    const stores = layered({ store, source: "local-storage" });

    const first = resolveIdentity(stores);
    const second = resolveIdentity(stores);

    expect(second.id).toBe(first.id);
    expect(second.isNew).toBe(false);
  });

  it("discards a value the host page wrote under our key", () => {
    const store = createMemoryStore();
    store.setItem(VISITOR_ID_KEY, "<not an id>");

    const identity = resolveIdentity(layered({ store, source: "local-storage" }));

    expect(identity.isNew).toBe(true);
    expect(isValidVisitorId(identity.id)).toBe(true);
  });

  it("falls through to the next store when one throws", () => {
    const cookie = createMemoryStore();
    const identity = resolveIdentity(
      layered(
        { store: hostileStore(), source: "local-storage" },
        { store: cookie, source: "cookie" },
      ),
    );

    expect(identity.source).toBe("cookie");
    expect(cookie.getItem(VISITOR_ID_KEY)).toBe(identity.id);
  });

  it("still returns an id when every store is unavailable", () => {
    const identity = resolveIdentity(layered({ store: hostileStore(), source: "memory" }));
    expect(isValidVisitorId(identity.id)).toBe(true);
  });

  it("heals a store that lost the id, so the visitor is not re-bucketed", () => {
    const local = createMemoryStore();
    const cookie = createMemoryStore();
    const stores = layered(
      { store: local, source: "local-storage" },
      { store: cookie, source: "cookie" },
    );

    const first = resolveIdentity(stores);
    local.removeItem(VISITOR_ID_KEY); // e.g. the visitor cleared site data for one mechanism

    const second = resolveIdentity(stores);

    expect(second.id).toBe(first.id);
    expect(second.source).toBe("cookie");
    expect(local.getItem(VISITOR_ID_KEY)).toBe(first.id);
  });
});

describe("cross-origin handoff", () => {
  it("adopts a visitor id handed over by a redirect", () => {
    const store = createMemoryStore();
    const handed = "11111111-2222-4333-8444-555555555555";

    const identity = resolveIdentity(layered({ store, source: "local-storage" }), {
      preferred: handed,
    });

    expect(identity.id).toBe(handed);
    expect(store.getItem(VISITOR_ID_KEY)).toBe(handed);
  });

  it("never overwrites an id that already exists on this origin", () => {
    const store = createMemoryStore();
    const first = resolveIdentity(layered({ store, source: "local-storage" }));

    const second = resolveIdentity(layered({ store, source: "local-storage" }), {
      preferred: "11111111-2222-4333-8444-555555555555",
    });

    expect(second.id).toBe(first.id);
  });

  it("ignores a malformed id from the URL", () => {
    const store = createMemoryStore();
    const identity = resolveIdentity(layered({ store, source: "local-storage" }), {
      preferred: '"><script>alert(1)</script>',
    });

    expect(isValidVisitorId(identity.id)).toBe(true);
    expect(identity.id).not.toContain("script");
  });
});
