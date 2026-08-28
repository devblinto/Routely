import { describe, expect, it, vi } from "vitest";

import { attachEngagement, createEngagementTimer } from "../src/engagement";

/** A controllable clock, so "time passing" is deterministic. */
function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("visible time accumulation", () => {
  it("counts time while the page is visible", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(3_000);
    expect(timer.total()).toBe(3_000);
  });

  it("counts nothing when the page starts hidden", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: false });

    c.advance(5_000);
    expect(timer.total()).toBe(0);
  });

  it("stops counting while hidden — this is visible time, not elapsed time", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(2_000);
    timer.pause();
    c.advance(60_000); // an hour in another tab must not count
    timer.resume();
    c.advance(1_000);

    expect(timer.total()).toBe(3_000);
  });

  it("accumulates across many visibility cycles", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    for (let i = 0; i < 5; i += 1) {
      c.advance(1_000);
      timer.pause();
      c.advance(10_000);
      timer.resume();
    }
    c.advance(500);

    expect(timer.total()).toBe(5_500);
  });

  it("ignores a resume while already visible", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(1_000);
    timer.resume();
    timer.resume();
    c.advance(1_000);

    expect(timer.total()).toBe(2_000);
  });

  it("caps an implausible interval, so a sleeping machine is not counted", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(48 * 60 * 60 * 1000); // two days
    expect(timer.total()).toBe(6 * 60 * 60 * 1000);
  });
});

describe("delta reporting", () => {
  it("reports only what accumulated since the last flush", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(2_000);
    expect(timer.take()).toBe(2_000);

    c.advance(3_000);
    expect(timer.take()).toBe(3_000);
  });

  it("sums the deltas to the total, so nothing is double counted", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    let reported = 0;
    for (let i = 0; i < 4; i += 1) {
      c.advance(1_500);
      reported += timer.take();
    }
    reported += timer.finalize();

    expect(reported).toBe(timer.total());
    expect(reported).toBe(6_000);
  });

  it("reports nothing when no time has passed", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    expect(timer.take()).toBe(0);
    c.advance(1_000);
    timer.take();
    expect(timer.take()).toBe(0);
  });

  it("keeps counting after a flush", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(1_000);
    timer.take();
    c.advance(2_000);

    expect(timer.unsent()).toBe(2_000);
  });
});

describe("preventing duplicate final events", () => {
  it("finalizes exactly once", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(4_000);
    expect(timer.finalize()).toBe(4_000);
    expect(timer.finalize()).toBe(0);
    expect(timer.finalize()).toBe(0);
    expect(timer.isFinalized()).toBe(true);
  });

  it("stops accumulating once finalized", () => {
    const c = clock();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    c.advance(1_000);
    timer.finalize();
    c.advance(10_000);
    timer.resume();
    c.advance(10_000);

    expect(timer.take()).toBe(0);
    expect(timer.total()).toBe(1_000);
  });
});

describe("lifecycle binding", () => {
  /** A minimal document with real event dispatch, so listener wiring is genuinely exercised. */
  function fakeDocument() {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      visibilityState: "visible" as DocumentVisibilityState,
      addEventListener: (type: string, fn: () => void) => {
        (listeners[type] ??= []).push(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn);
      },
      dispatch: (type: string) => (listeners[type] ?? []).forEach((fn) => fn()),
      count: (type: string) => (listeners[type] ?? []).length,
    };
  }

  it("flushes when the page becomes hidden", () => {
    const c = clock();
    const doc = fakeDocument();
    const timer = createEngagementTimer({ now: c.now, visible: true });
    const flush = vi.fn();

    attachEngagement(timer, flush, doc as unknown as Document);

    c.advance(2_500);
    doc.visibilityState = "hidden";
    doc.dispatch("visibilitychange");

    expect(flush).toHaveBeenCalledWith(2_500, false);
  });

  it("resumes when the page becomes visible again", () => {
    const c = clock();
    const doc = fakeDocument();
    const timer = createEngagementTimer({ now: c.now, visible: true });
    const flush = vi.fn();

    attachEngagement(timer, flush, doc as unknown as Document);

    c.advance(1_000);
    doc.visibilityState = "hidden";
    doc.dispatch("visibilitychange");

    c.advance(30_000); // hidden — must not count

    doc.visibilityState = "visible";
    doc.dispatch("visibilitychange");
    c.advance(2_000);

    expect(timer.total()).toBe(3_000);
  });

  it("does not flush when nothing accumulated", () => {
    const c = clock();
    const doc = fakeDocument();
    const flush = vi.fn();

    attachEngagement(
      createEngagementTimer({ now: c.now, visible: true }),
      flush,
      doc as unknown as Document,
    );

    doc.visibilityState = "hidden";
    doc.dispatch("visibilitychange");

    expect(flush).not.toHaveBeenCalled();
  });

  it("detaches its listeners so a bfcache restore cannot double-report", () => {
    const c = clock();
    const doc = fakeDocument();
    const timer = createEngagementTimer({ now: c.now, visible: true });

    attachEngagement(timer, vi.fn(), doc as unknown as Document);
    expect(doc.count("visibilitychange")).toBe(1);

    c.advance(1_000);
    // `pagehide` is dispatched on window, which the fake does not model; finalizing directly
    // covers the same path.
    timer.finalize();

    doc.visibilityState = "hidden";
    doc.dispatch("visibilitychange");
    expect(timer.take()).toBe(0);
  });

  it("is a no-op without a document", () => {
    const timer = createEngagementTimer({ now: clock().now, visible: true });
    expect(() => attachEngagement(timer, vi.fn(), undefined).detach()).not.toThrow();
  });
});
