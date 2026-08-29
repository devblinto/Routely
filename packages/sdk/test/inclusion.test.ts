import { describe, expect, it } from "vitest";

import { createMemoryStore } from "../src/env";
import { inclusionKey, readInclusion, resolveInclusion, writeInclusion } from "../src/inclusion";

/** A deterministic source of "randomness", so a draw can be aimed either way. */
const fixed = (value: number) => () => value;

describe("resolveInclusion", () => {
  it("includes a visitor below the allocation boundary", () => {
    const stores = [createMemoryStore()];
    const result = resolveInclusion("exp_1", 50, stores, { random: fixed(0.2) });
    expect(result).toEqual({ included: true, isNew: true });
  });

  it("excludes a visitor at or above the allocation boundary", () => {
    const stores = [createMemoryStore()];
    const result = resolveInclusion("exp_1", 50, stores, { random: fixed(0.8) });
    expect(result).toEqual({ included: false, isNew: true });
  });

  it("always includes at 100%", () => {
    const stores = [createMemoryStore()];
    expect(resolveInclusion("exp_1", 100, stores, { random: fixed(0.999) }).included).toBe(true);
  });

  it("never includes at 0%", () => {
    const stores = [createMemoryStore()];
    expect(resolveInclusion("exp_1", 0, stores, { random: fixed(0) }).included).toBe(false);
  });

  it("clamps an out-of-range allocation rather than trusting it blindly", () => {
    const stores = [createMemoryStore()];
    expect(resolveInclusion("exp_1", 500, stores, { random: fixed(0.99) }).included).toBe(true);
    expect(resolveInclusion("exp_2", -10, stores, { random: fixed(0.01) }).included).toBe(false);
  });

  it("persists the decision rather than re-drawing on a later call", () => {
    const stores = [createMemoryStore()];
    const first = resolveInclusion("exp_1", 50, stores, { random: fixed(0.1) });
    // A second call with a random source that would draw the opposite result must still return
    // the stored decision — this is what makes a visitor's participation stable across visits.
    const second = resolveInclusion("exp_1", 50, stores, { random: fixed(0.9) });

    expect(second).toEqual({ included: first.included, isNew: false });
  });

  it("keeps experiments independent of one another", () => {
    const stores = [createMemoryStore()];
    resolveInclusion("exp_1", 50, stores, { random: fixed(0.1) });
    const other = resolveInclusion("exp_2", 50, stores, { random: fixed(0.1) });

    expect(other.isNew).toBe(true);
  });
});

describe("readInclusion / writeInclusion", () => {
  it("round-trips through a store", () => {
    const store = createMemoryStore();
    writeInclusion("exp_1", { included: true, at: 123 }, [store]);
    expect(readInclusion("exp_1", [store])).toEqual({ included: true, at: 123 });
  });

  it("treats a corrupted entry as absent", () => {
    const store = createMemoryStore();
    store.setItem(inclusionKey("exp_1"), "{not json");
    expect(readInclusion("exp_1", [store])).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(readInclusion("exp_1", [createMemoryStore()])).toBeNull();
  });
});
