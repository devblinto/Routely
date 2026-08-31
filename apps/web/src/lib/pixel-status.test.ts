import { describe, expect, it } from "vitest";

import { PIXEL_STATUS, resolvePixelStatus } from "./pixel-status";

describe("resolvePixelStatus", () => {
  it("reports receiving once data has arrived", () => {
    expect(resolvePixelStatus(true, null)).toBe("receiving");
  });

  it("prefers data over a verification, which is only ever a past observation", () => {
    expect(resolvePixelStatus(true, new Date("2020-01-01"))).toBe("receiving");
  });

  it("reports connected when the snippet was confirmed but nothing has reported", () => {
    // The normal state for a website just set up: correctly installed, no experiment running,
    // so the SDK has nothing to send. This is the case that used to read "Pixel not detected".
    expect(resolvePixelStatus(false, new Date())).toBe("connected");
  });

  it("reports unknown when neither has happened", () => {
    expect(resolvePixelStatus(false, null)).toBe("unknown");
  });
});

describe("PIXEL_STATUS labels", () => {
  it("never tells a verified website its pixel is missing", () => {
    expect(PIXEL_STATUS.connected.positive).toBe(true);
    expect(PIXEL_STATUS.connected.label).not.toMatch(/not|missing/i);
  });

  it("covers every state", () => {
    for (const key of ["receiving", "connected", "unknown"] as const) {
      expect(PIXEL_STATUS[key].label).toBeTruthy();
      expect(PIXEL_STATUS[key].hint).toBeTruthy();
    }
  });
});
