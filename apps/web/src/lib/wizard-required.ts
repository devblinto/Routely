/**
 * Which required fields on the experiment wizard are still blank.
 *
 * Deliberately dependency-free and pure, so it can be tested without a DOM, a database or a
 * session — and so the rule about *what* is required is stated in exactly one place rather
 * than being spread across the markup of six steps.
 *
 * This is **not** a second source of truth for whether an experiment is valid. The Zod schema
 * in `validation/experiment.ts` remains the authority, and everything interesting — URL shape,
 * same-site enforcement, control/variant/goal collisions, weights — is left to it. All this
 * answers is "has the customer filled the box in yet", which the server cannot answer in time
 * to be useful: it only ever sees the form once, at the end.
 */

export type WizardStepKey =
  "website" | "profile" | "audience" | "metrics" | "configuration" | "summary";

/** The subset of the wizard's state that required-ness depends on. */
export interface RequiredCheckValues {
  websiteId: string;
  name: string;
  controlUrl: string;
  variants: { url: string }[];
  conversionUrl: string;
}

export type FieldErrors = Record<string, string[]>;

/**
 * Blank required fields for one step.
 *
 * `description` is absent on purpose: "What are you testing?" is the one optional field on the
 * Profile step, and its hint says so.
 */
export function requiredFieldErrors(step: WizardStepKey, values: RequiredCheckValues): FieldErrors {
  const errors: FieldErrors = {};

  if (step === "website" && !values.websiteId.trim()) {
    errors["websiteId"] = ["Choose a website"];
  }

  if (step === "profile") {
    if (!values.name.trim()) errors["name"] = ["Give this experiment a name"];
    if (!values.controlUrl.trim()) errors["controlUrl"] = ["Enter the control URL"];

    // Keyed per row (`variants.0`, `variants.1`, …) rather than collapsed under `variants`:
    // with several variants on screen, one shared message cannot say which box is empty. Every
    // variant is required, including ones added with "Add URL Variant" — an arm with no URL is
    // an arm the SDK could bucket a visitor into and then have nowhere to send them.
    values.variants.forEach((variant, index) => {
      if (!variant.url.trim()) {
        errors[`variants.${index}`] = [`Enter the URL for variant ${index + 1}`];
      }
    });
  }

  if (step === "metrics" && !values.conversionUrl.trim()) {
    errors["conversionUrl"] = ["Enter the conversion URL"];
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * The first step in `order` with a blank required field, or `undefined` when none has one.
 * Used to send a customer straight to the step that needs attention instead of opening a
 * review of an experiment that cannot be created.
 */
export function firstIncompleteStep(
  order: readonly WizardStepKey[],
  values: RequiredCheckValues,
): WizardStepKey | undefined {
  return order.find((step) => hasErrors(requiredFieldErrors(step, values)));
}
