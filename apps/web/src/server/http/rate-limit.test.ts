import { beforeEach, describe, expect, it } from "vitest";

import { clientAddress, rateLimit, resetRateLimits } from "./rate-limit";

beforeEach(() => resetRateLimits());

describe("rateLimit", () => {
  it("allows requests up to the limit", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit("k", 5, 1000, 0).allowed).toBe(true);
    }
  });

  it("refuses the request after the limit", () => {
    for (let i = 0; i < 5; i += 1) rateLimit("k", 5, 1000, 0);

    const blocked = rateLimit("k", 5, 1000, 0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("recovers when the window rolls over", () => {
    for (let i = 0; i < 6; i += 1) rateLimit("k", 5, 1000, 0);
    expect(rateLimit("k", 5, 1000, 1001).allowed).toBe(true);
  });

  it("keeps separate keys independent, so one visitor cannot exhaust another's budget", () => {
    for (let i = 0; i < 6; i += 1) rateLimit("site:a", 5, 1000, 0);

    expect(rateLimit("site:a", 5, 1000, 0).allowed).toBe(false);
    expect(rateLimit("site:b", 5, 1000, 0).allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  it("takes the first entry of X-Forwarded-For, which the proxy controls", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(clientAddress(headers)).toBe("203.0.113.5");
  });

  it("falls back to X-Real-IP, then to a constant", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
