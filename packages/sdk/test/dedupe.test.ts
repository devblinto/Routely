import { beforeEach, describe, expect, it } from "vitest";

import { claimPageView, pageViewKey, resetPageViewGuard } from "../src/dedupe";
import { createMemoryStore } from "../src/env";

beforeEach(() => resetPageViewGuard());

describe("page view deduplication", () => {
  it("reports the first page view", () => {
    expect(claimPageView("exp_1", "https://acme.test/p", createMemoryStore(), 1_000)).toBe(true);
  });

  it("suppresses a repeat from the same bundle instance", () => {
    const store = createMemoryStore();
    claimPageView("exp_1", "https://acme.test/p", store, 1_000);
    expect(claimPageView("exp_1", "https://acme.test/p", store, 1_001)).toBe(false);
  });

  it("suppresses a second copy of the SDK on the same page", () => {
    // A separate bundle instance has its own module scope, so the shared session store is the
    // only thing that can tell it the page was already reported.
    const store = createMemoryStore();
    claimPageView("exp_1", "https://acme.test/p", store, 1_000);

    resetPageViewGuard(); // simulates a second, independent copy of the script
    expect(claimPageView("exp_1", "https://acme.test/p", store, 1_050)).toBe(false);
  });

  it("counts a genuine reload once the window has passed", () => {
    const store = createMemoryStore();
    claimPageView("exp_1", "https://acme.test/p", store, 1_000);

    resetPageViewGuard();
    expect(claimPageView("exp_1", "https://acme.test/p", store, 1_000 + 6_000)).toBe(true);
  });

  it("treats a different page as a different view", () => {
    const store = createMemoryStore();
    claimPageView("exp_1", "https://acme.test/p", store, 1_000);

    resetPageViewGuard();
    expect(claimPageView("exp_1", "https://acme.test/other", store, 1_050)).toBe(true);
  });

  it("keeps experiments independent", () => {
    const store = createMemoryStore();
    claimPageView("exp_1", "https://acme.test/p", store, 1_000);

    resetPageViewGuard();
    expect(claimPageView("exp_2", "https://acme.test/p", store, 1_050)).toBe(true);
    expect(pageViewKey("exp_1", "u")).not.toBe(pageViewKey("exp_2", "u"));
  });

  it("still guards the common case when storage is unavailable", () => {
    expect(claimPageView("exp_1", "https://acme.test/p", null, 1_000)).toBe(true);
    expect(claimPageView("exp_1", "https://acme.test/p", null, 1_001)).toBe(false);
  });
});
