import { describe, expect, it } from "vitest";

import {
  assignmentKey,
  drawVariant,
  readAssignment,
  resolveAssignment,
  writeAssignment,
} from "../src/assignment";
import type { ExperimentConfig } from "../src/contract";
import { createMemoryStore } from "../src/env";

const EXPERIMENT: ExperimentConfig = {
  id: "exp_1",
  control: { url: "https://acme.test/pricing", match: "EXACT" },
  variantUrl: "https://acme.test/pricing-v2",
  goal: { url: "https://acme.test/thanks", match: "EXACT" },
  variantSplit: 50,
};

/** A deterministic source of "randomness", so a draw can be aimed at either arm. */
const fixed = (value: number) => () => value;

describe("drawVariant", () => {
  it("respects the split boundaries", () => {
    expect(drawVariant(50, fixed(0.49))).toBe("VARIANT");
    expect(drawVariant(50, fixed(0.5))).toBe("CONTROL");
    expect(drawVariant(50, fixed(0.99))).toBe("CONTROL");
  });

  it("falls back to an even split on a nonsense value", () => {
    expect(drawVariant(Number.NaN, fixed(0.25))).toBe("VARIANT");
    expect(drawVariant(Number.NaN, fixed(0.75))).toBe("CONTROL");
  });

  it("clamps a split outside 0–100", () => {
    expect(drawVariant(500, fixed(0.99))).toBe("VARIANT");
    expect(drawVariant(-20, fixed(0.001))).toBe("CONTROL");
  });
});

describe("distribution", () => {
  it("is approximately balanced across many new visitors", () => {
    const trials = 20_000;
    let variant = 0;

    for (let i = 0; i < trials; i += 1) {
      // Each iteration is a distinct new visitor: a fresh store means no prior assignment.
      const store = [createMemoryStore()];
      if (resolveAssignment(EXPERIMENT, store).variant === "VARIANT") variant += 1;
    }

    const share = variant / trials;
    // ±2 points. A true 50/50 over 20k draws has a standard deviation of ~0.35 points, so
    // this is ~5.7σ — tight enough to catch a real bias, loose enough not to flake.
    expect(share).toBeGreaterThan(0.48);
    expect(share).toBeLessThan(0.52);
  });

  it("honours a split other than 50/50", () => {
    const trials = 20_000;
    let variant = 0;

    for (let i = 0; i < trials; i += 1) {
      const store = [createMemoryStore()];
      if (resolveAssignment({ ...EXPERIMENT, variantSplit: 20 }, store).variant === "VARIANT") {
        variant += 1;
      }
    }

    expect(variant / trials).toBeGreaterThan(0.18);
    expect(variant / trials).toBeLessThan(0.22);
  });
});

describe("assignment consistency", () => {
  it("does not re-randomise on a repeat visit", () => {
    const stores = [createMemoryStore()];
    const first = resolveAssignment(EXPERIMENT, stores);

    // Draws are forced to the *opposite* arm; a stored assignment must win regardless.
    const opposite = first.variant === "VARIANT" ? fixed(0.99) : fixed(0.01);

    for (let i = 0; i < 50; i += 1) {
      const again = resolveAssignment(EXPERIMENT, stores, { random: opposite });
      expect(again.variant).toBe(first.variant);
      expect(again.isNew).toBe(false);
    }
  });

  it("keeps separate experiments independent", () => {
    const stores = [createMemoryStore()];
    resolveAssignment(EXPERIMENT, stores, { random: fixed(0.1) });
    resolveAssignment({ ...EXPERIMENT, id: "exp_2" }, stores, { random: fixed(0.9) });

    expect(readAssignment("exp_1", stores)?.variant).toBe("VARIANT");
    expect(readAssignment("exp_2", stores)?.variant).toBe("CONTROL");
    expect(assignmentKey("exp_1")).not.toBe(assignmentKey("exp_2"));
  });

  it("applies a handed-over decision only when nothing is stored", () => {
    const fresh = [createMemoryStore()];
    expect(resolveAssignment(EXPERIMENT, fresh, { forced: "VARIANT" }).variant).toBe("VARIANT");

    // An existing assignment must not be overwritten by a value from a query string.
    const existing = [createMemoryStore()];
    resolveAssignment(EXPERIMENT, existing, { random: fixed(0.99) }); // CONTROL
    expect(resolveAssignment(EXPERIMENT, existing, { forced: "VARIANT" }).variant).toBe("CONTROL");
  });

  it("re-draws when the stored value is corrupted", () => {
    const store = createMemoryStore();
    store.setItem(assignmentKey(EXPERIMENT.id), "{not json");

    const result = resolveAssignment(EXPERIMENT, [store], { random: fixed(0.1) });
    expect(result.variant).toBe("VARIANT");
    expect(result.isNew).toBe(true);
  });

  it("ignores a stored value that is not a variant", () => {
    const store = createMemoryStore();
    store.setItem(assignmentKey(EXPERIMENT.id), JSON.stringify({ variant: "SOMETHING_ELSE" }));

    expect(resolveAssignment(EXPERIMENT, [store], { random: fixed(0.99) }).variant).toBe("CONTROL");
  });

  it("survives a page refresh, which reads the same store again", () => {
    const store = createMemoryStore();
    const first = resolveAssignment(EXPERIMENT, [store]);

    // A refresh: new arrays, same underlying storage.
    for (let i = 0; i < 5; i += 1) {
      expect(resolveAssignment(EXPERIMENT, [store]).variant).toBe(first.variant);
    }
  });

  it("writes to every store so one being cleared does not re-bucket the visitor", () => {
    const local = createMemoryStore();
    const memory = createMemoryStore();
    const first = resolveAssignment(EXPERIMENT, [local, memory]);

    local.removeItem(assignmentKey(EXPERIMENT.id));

    expect(resolveAssignment(EXPERIMENT, [local, memory]).variant).toBe(first.variant);
  });

  it("marks an assignment as reported without changing the arm", () => {
    const stores = [createMemoryStore()];
    const first = resolveAssignment(EXPERIMENT, stores);

    writeAssignment(EXPERIMENT.id, { variant: first.variant, at: 0, sent: true }, stores);

    expect(readAssignment(EXPERIMENT.id, stores)?.sent).toBe(true);
    expect(readAssignment(EXPERIMENT.id, stores)?.variant).toBe(first.variant);
  });
});
