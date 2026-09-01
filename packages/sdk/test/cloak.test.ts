import { describe, expect, it, vi } from "vitest";

import { revealPage } from "../src/cloak";

/**
 * The overlay itself is created by the anti-flickering script the customer pastes into their
 * page, not by the bundle — so what is testable here is the handover: the SDK ends the wait
 * early when that script is present, and does nothing harmful when it is not.
 */

describe("revealPage", () => {
  it("calls the reveal function the anti-flickering script published", () => {
    const reveal = vi.fn();
    revealPage({ __routelyReveal: reveal });

    expect(reveal).toHaveBeenCalledOnce();
  });

  it("does nothing when the anti-flickering script is not installed", () => {
    // A supported installation: the customer gets the tracking and keeps the flicker. It must
    // not be an error path.
    expect(() => revealPage({})).not.toThrow();
  });

  it("ignores a host with no window at all", () => {
    expect(() => revealPage(undefined)).not.toThrow();
    expect(() => revealPage(null)).not.toThrow();
  });

  it("ignores a global that is not a function", () => {
    // The name could collide with something on the host page, so its type is checked rather
    // than assumed.
    expect(() => revealPage({ __routelyReveal: "not a function" })).not.toThrow();
    expect(() => revealPage({ __routelyReveal: 42 })).not.toThrow();
    expect(() => revealPage({ __routelyReveal: null })).not.toThrow();
  });

  it("never lets a throwing host function reach the page", () => {
    const reveal = vi.fn(() => {
      throw new Error("host page is broken");
    });

    expect(() => revealPage({ __routelyReveal: reveal })).not.toThrow();
    expect(reveal).toHaveBeenCalledOnce();
  });

  it("is safe to call more than once", () => {
    // The snippet's own function is idempotent; this asserts the SDK side adds no state that
    // would make a second call misbehave.
    const reveal = vi.fn();
    const host = { __routelyReveal: reveal };

    revealPage(host);
    revealPage(host);

    expect(reveal).toHaveBeenCalledTimes(2);
  });
});
