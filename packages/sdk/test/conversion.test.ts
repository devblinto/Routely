import { beforeEach, describe, expect, it } from "vitest";

import {
  claimConversion,
  conversionKey,
  findGoalMatches,
  resetConversionGuard,
} from "../src/conversion";
import type { ExperimentConfig } from "../src/contract";
import { createMemoryStore } from "../src/env";

beforeEach(() => resetConversionGuard());

const GOAL = "https://acme.test/thank-you";

const EXPERIMENT: ExperimentConfig = {
  id: "exp_1",
  control: { url: "https://acme.test/pricing", match: "EXACT" },
  controlWeight: 50,
  variants: [{ id: "var_1", url: "https://acme.test/pricing-v2", weight: 50 }],
  goal: { url: GOAL, match: "EXACT" },
  trafficAllocation: 100,
};

describe("goal matching", () => {
  it("matches the conversion page", () => {
    expect(findGoalMatches(GOAL, [EXPERIMENT]).map((e) => e.id)).toEqual(["exp_1"]);
  });

  it("matches despite trailing slashes, fragments and campaign parameters", () => {
    expect(findGoalMatches(`${GOAL}/?utm_source=email#top`, [EXPERIMENT])).toHaveLength(1);
  });

  it("does not match the control or variant page", () => {
    expect(findGoalMatches(EXPERIMENT.control.url, [EXPERIMENT])).toHaveLength(0);
    expect(findGoalMatches(EXPERIMENT.variants[0]!.url, [EXPERIMENT])).toHaveLength(0);
  });

  it("does not match an unrelated page", () => {
    expect(findGoalMatches("https://acme.test/about", [EXPERIMENT])).toHaveLength(0);
  });

  it("returns every experiment sharing the goal", () => {
    // Two tests on one site can legitimately end at the same thank-you page.
    const second: ExperimentConfig = { ...EXPERIMENT, id: "exp_2" };
    expect(findGoalMatches(GOAL, [EXPERIMENT, second]).map((e) => e.id)).toEqual([
      "exp_1",
      "exp_2",
    ]);
  });

  it("honours PREFIX goals without capturing a similarly-named page", () => {
    const prefix: ExperimentConfig = {
      ...EXPERIMENT,
      goal: { url: "https://acme.test/order", match: "PREFIX" },
    };
    expect(findGoalMatches("https://acme.test/order/123", [prefix])).toHaveLength(1);
    expect(findGoalMatches("https://acme.test/orders", [prefix])).toHaveLength(0);
  });
});

describe("duplicate conversion prevention", () => {
  it("claims the first conversion", () => {
    expect(claimConversion("exp_1", createMemoryStore(), 1_000)).toBe(true);
  });

  it("refuses a repeat within the same page load", () => {
    const store = createMemoryStore();
    claimConversion("exp_1", store, 1_000);
    expect(claimConversion("exp_1", store, 1_001)).toBe(false);
  });

  it("refuses a repeat after a refresh", () => {
    const store = createMemoryStore();
    claimConversion("exp_1", store, 1_000);

    resetConversionGuard(); // a refresh: new instance, same storage
    expect(claimConversion("exp_1", store, 2_000)).toBe(false);
  });

  it("refuses a repeat days later — a conversion is once per assignment, not per session", () => {
    const store = createMemoryStore();
    claimConversion("exp_1", store, 1_000);

    resetConversionGuard();
    expect(claimConversion("exp_1", store, 1_000 + 7 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("refuses a second copy of the SDK on the same page", () => {
    const store = createMemoryStore();
    claimConversion("exp_1", store, 1_000);

    resetConversionGuard(); // an independent bundle instance shares only the storage
    expect(claimConversion("exp_1", store, 1_010)).toBe(false);
  });

  it("keeps experiments independent", () => {
    const store = createMemoryStore();
    claimConversion("exp_1", store, 1_000);

    expect(claimConversion("exp_2", store, 1_000)).toBe(true);
    expect(conversionKey("exp_1")).not.toBe(conversionKey("exp_2"));
  });

  it("still guards the common case without storage", () => {
    expect(claimConversion("exp_1", null, 1_000)).toBe(true);
    expect(claimConversion("exp_1", null, 1_001)).toBe(false);
  });
});
