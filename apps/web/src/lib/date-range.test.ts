import { describe, expect, it } from "vitest";

import { DEFAULT_RANGE, parseRangeKey, resolveRange } from "./date-range";

describe("parseRangeKey", () => {
  it("accepts the known keys", () => {
    expect(parseRangeKey("7d")).toBe("7d");
    expect(parseRangeKey("all")).toBe("all");
  });

  it("falls back to the default for anything else", () => {
    for (const bad of ["", "forever", "7", null, undefined, 7, {}]) {
      expect(parseRangeKey(bad)).toBe(DEFAULT_RANGE);
    }
  });
});

describe("resolveRange", () => {
  const now = new Date("2026-08-28T12:00:00Z");

  it("returns no filter for all time, so the query stays unbounded", () => {
    expect(resolveRange("all", now)).toBeUndefined();
  });

  it("spans the right number of days", () => {
    const week = resolveRange("7d", now)!;
    expect(week.to).toEqual(now);
    expect(week.from.toISOString()).toBe("2026-08-21T12:00:00.000Z");

    expect(resolveRange("24h", now)!.from.toISOString()).toBe("2026-08-27T12:00:00.000Z");
    expect(resolveRange("90d", now)!.from.toISOString()).toBe("2026-05-30T12:00:00.000Z");
  });
});
