import { describe, expect, it } from "vitest";

import type { ExperimentConfig, VariantKey } from "../src/contract";
import { createMemoryStore } from "../src/env";
import { countRedirects, decide, findExperimentForUrl, recordRedirect } from "../src/redirect";
import { readHandoff, stripHandoff, withHandoff } from "../src/url";

const CONTROL = "https://acme.test/pricing";
const VARIANT = "https://acme.test/pricing-v2";

const EXPERIMENT: ExperimentConfig = {
  id: "exp_1",
  control: { url: CONTROL, match: "EXACT" },
  variantUrl: VARIANT,
  goal: { url: "https://acme.test/thanks", match: "EXACT" },
  variantSplit: 50,
};

const always = (variant: VariantKey) => () => variant;
const ctx = (sessionStore = createMemoryStore()) => ({ visitorId: "v-123", sessionStore });

describe("matching", () => {
  it("matches the control page", () => {
    expect(findExperimentForUrl(CONTROL, [EXPERIMENT])?.id).toBe("exp_1");
  });

  it("matches despite trailing slashes, fragments and campaign parameters", () => {
    expect(findExperimentForUrl(`${CONTROL}/?utm_source=ads#plans`, [EXPERIMENT])).toBeTruthy();
  });

  it("does not match an unrelated page", () => {
    expect(findExperimentForUrl("https://acme.test/about", [EXPERIMENT])).toBeNull();
  });

  it("never matches on the variant URL", () => {
    expect(findExperimentForUrl(VARIANT, [EXPERIMENT])).toBeNull();
  });

  it("does not let a PREFIX rule capture a similarly-named page", () => {
    const prefix: ExperimentConfig = {
      ...EXPERIMENT,
      control: { url: "https://acme.test/pricing", match: "PREFIX" },
    };
    expect(findExperimentForUrl("https://acme.test/pricing-old", [prefix])).toBeNull();
    expect(findExperimentForUrl("https://acme.test/pricing/plans", [prefix])).toBeTruthy();
  });
});

describe("redirect loop prevention", () => {
  it("redirects a variant visitor away from the control page", () => {
    const decision = decide(CONTROL, [EXPERIMENT], always("VARIANT"), ctx());
    expect(decision?.action).toBe("redirect");
    expect(decision?.action === "redirect" && decision.target).toContain(VARIANT);
  });

  it("leaves a control visitor where they are", () => {
    expect(decide(CONTROL, [EXPERIMENT], always("CONTROL"), ctx())?.action).toBe("stay");
  });

  it("does nothing on the variant page itself", () => {
    // Guard 1: the variant is never a trigger.
    expect(decide(VARIANT, [EXPERIMENT], always("VARIANT"), ctx())).toBeNull();
  });

  it("does not redirect again when the variant sits under a PREFIX control", () => {
    // Guard 1 in the case that actually needs it: `/pricing` with PREFIX matching also claims
    // `/pricing/v2`, so matching the control does not prove this is the control page.
    const nested: ExperimentConfig = {
      ...EXPERIMENT,
      control: { url: "https://acme.test/pricing", match: "PREFIX" },
      variantUrl: "https://acme.test/pricing/v2",
    };

    const decision = decide("https://acme.test/pricing/v2", [nested], always("VARIANT"), ctx());
    expect(decision?.action).toBe("skip");
    expect(decision?.action === "skip" && decision.reason).toBe("already-on-variant");
  });

  it("does not redirect a page reached by this experiment's own redirect", () => {
    // Guard 2: the handoff parameters say this page load *is* the redirect's result. Works
    // across origins, where storage from the control page is unavailable.
    const arrived = withHandoff(VARIANT, {
      visitorId: "v-123",
      experimentId: "exp_1",
      variant: "VARIANT",
    });

    const nested: ExperimentConfig = {
      ...EXPERIMENT,
      control: { url: "https://acme.test/pricing", match: "PREFIX" },
      variantUrl: "https://acme.test/pricing/v2",
    };
    const arrivedNested = withHandoff("https://acme.test/pricing/v2/", {
      visitorId: "v-123",
      experimentId: "exp_1",
      variant: "VARIANT",
    });

    expect(decide(arrived, [EXPERIMENT], always("VARIANT"), ctx())).toBeNull();

    const decision = decide(arrivedNested, [nested], always("VARIANT"), ctx());
    expect(decision?.action).toBe("skip");
  });

  it("refuses a second redirect in the same session", () => {
    // Guard 3: even if every other guard were bypassed, the counter stops a bounce.
    const session = createMemoryStore();
    recordRedirect("exp_1", session);

    const decision = decide(CONTROL, [EXPERIMENT], always("VARIANT"), ctx(session));
    expect(decision?.action).toBe("skip");
    expect(decision?.action === "skip" && decision.reason).toBe("already-redirected");
    expect(countRedirects("exp_1", session)).toBe(1);
  });

  it("never navigates to the page already displayed", () => {
    // Guard 4: a misconfiguration where the variant resolves to the current URL.
    const degenerate: ExperimentConfig = { ...EXPERIMENT, variantUrl: `${CONTROL}/` };
    const decision = decide(CONTROL, [degenerate], always("VARIANT"), ctx());
    expect(decision?.action).not.toBe("redirect");
  });

  it("carries identity across the redirect and cleans it off afterwards", () => {
    const decision = decide(CONTROL, [EXPERIMENT], always("VARIANT"), ctx());
    const target = decision?.action === "redirect" ? decision.target : "";

    expect(readHandoff(target)).toEqual({
      visitorId: "v-123",
      experimentId: "exp_1",
      variant: "VARIANT",
    });
    expect(stripHandoff(target)).toBe(`${VARIANT}`);
  });
});

describe("experiment status", () => {
  it("does nothing for a paused experiment", () => {
    // A paused experiment is absent from the configuration the endpoint publishes, so the SDK
    // sees an empty list. There is no client-side "is this paused?" check to get wrong.
    expect(decide(CONTROL, [], always("VARIANT"), ctx())).toBeNull();
  });

  it("does nothing for a draft experiment", () => {
    // Same mechanism: a draft is never published, so it cannot affect a visitor.
    expect(decide(CONTROL, [], always("VARIANT"), ctx())).toBeNull();
  });

  it("only acts on the experiments it was given", () => {
    const other: ExperimentConfig = {
      ...EXPERIMENT,
      id: "exp_other",
      control: { url: "https://acme.test/other", match: "EXACT" },
    };
    expect(decide(CONTROL, [other], always("VARIANT"), ctx())).toBeNull();
  });
});
