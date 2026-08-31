import { describe, expect, it } from "vitest";

import {
  type RequiredCheckValues,
  type WizardStepKey,
  firstIncompleteStep,
  hasErrors,
  requiredFieldErrors,
} from "@/lib/wizard-required";

const ORDER: readonly WizardStepKey[] = [
  "website",
  "profile",
  "audience",
  "metrics",
  "configuration",
  "summary",
];

function values(overrides: Partial<RequiredCheckValues> = {}): RequiredCheckValues {
  return {
    websiteId: "web_1",
    name: "Pricing page redesign",
    controlUrl: "https://acme.test/pricing",
    variants: [{ url: "https://acme.test/pricing-v1" }],
    conversionUrl: "https://acme.test/thank-you",
    ...overrides,
  };
}

describe("profile step", () => {
  it("passes when every required field is filled", () => {
    expect(requiredFieldErrors("profile", values())).toEqual({});
  });

  it("requires the experiment name", () => {
    expect(requiredFieldErrors("profile", values({ name: "" }))).toHaveProperty("name");
    // Whitespace is not a name.
    expect(requiredFieldErrors("profile", values({ name: "   " }))).toHaveProperty("name");
  });

  it("requires the control URL", () => {
    expect(requiredFieldErrors("profile", values({ controlUrl: "" }))).toHaveProperty("controlUrl");
    expect(requiredFieldErrors("profile", values({ controlUrl: "  " }))).toHaveProperty(
      "controlUrl",
    );
  });

  it("requires the first variant URL", () => {
    const errors = requiredFieldErrors("profile", values({ variants: [{ url: "" }] }));
    expect(errors["variants.0"]).toEqual(["Enter the URL for variant 1"]);
  });

  it("requires every added variant, not just the first", () => {
    const errors = requiredFieldErrors(
      "profile",
      values({
        variants: [{ url: "https://acme.test/a" }, { url: "" }, { url: "" }],
      }),
    );

    // The filled row is not flagged; each blank one is named individually so the message can
    // sit under the box it belongs to.
    expect(errors["variants.0"]).toBeUndefined();
    expect(errors["variants.1"]).toEqual(["Enter the URL for variant 2"]);
    expect(errors["variants.2"]).toEqual(["Enter the URL for variant 3"]);
  });

  it("leaves the description optional — it is the only optional field on the step", () => {
    // "What are you testing?" is absent from the value type entirely, so no amount of blankness
    // can produce an error for it. This asserts the whole step passes without one.
    expect(requiredFieldErrors("profile", values())).toEqual({});
    expect("description" in requiredFieldErrors("profile", values({ name: "" }))).toBe(false);
  });

  it("reports every blank field at once rather than one at a time", () => {
    const errors = requiredFieldErrors(
      "profile",
      values({ name: "", controlUrl: "", variants: [{ url: "" }] }),
    );

    expect(Object.keys(errors).sort()).toEqual(["controlUrl", "name", "variants.0"]);
  });
});

describe("other steps", () => {
  it("requires a website on the website step", () => {
    expect(requiredFieldErrors("website", values({ websiteId: "" }))).toHaveProperty("websiteId");
  });

  it("requires the conversion URL on the metrics step", () => {
    expect(requiredFieldErrors("metrics", values({ conversionUrl: "" }))).toHaveProperty(
      "conversionUrl",
    );
  });

  it("does not raise a step's errors on a different step", () => {
    // Blank profile fields must not block the metrics step, or a customer would be stuck on a
    // step whose own fields are all filled in.
    const blank = values({ name: "", controlUrl: "", variants: [{ url: "" }] });
    expect(requiredFieldErrors("metrics", blank)).toEqual({});
    expect(requiredFieldErrors("audience", blank)).toEqual({});
    expect(requiredFieldErrors("configuration", blank)).toEqual({});
    expect(requiredFieldErrors("summary", blank)).toEqual({});
  });
});

describe("firstIncompleteStep", () => {
  it("is undefined when the whole wizard is filled in", () => {
    expect(firstIncompleteStep(ORDER, values())).toBeUndefined();
  });

  it("finds the earliest incomplete step, not just any", () => {
    const blank = values({ name: "", conversionUrl: "" });
    expect(firstIncompleteStep(ORDER, blank)).toBe("profile");
  });

  it("finds a later step when the earlier ones are complete", () => {
    expect(firstIncompleteStep(ORDER, values({ conversionUrl: "" }))).toBe("metrics");
  });

  it("catches a variant cleared after the step was already passed", () => {
    // The stepper allows jumping back to a visited step, so this is reachable: fill everything,
    // return to Profile, clear a variant, then skip forward to Summary.
    expect(firstIncompleteStep(ORDER, values({ variants: [{ url: "" }] }))).toBe("profile");
  });
});

describe("hasErrors", () => {
  it("distinguishes an empty bag from a populated one", () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ name: ["Give this experiment a name"] })).toBe(true);
  });
});
