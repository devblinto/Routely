import { z } from "zod";

import { ExperimentStatus, PrimaryMetric, UrlMatchType } from "@/generated/prisma/enums";
import { isSameUrl } from "@/lib/url";
import {
  absoluteUrlSchema,
  displayNameSchema,
  idSchema,
  trafficAllocationSchema,
} from "@/validation/common";

export const urlMatchTypeSchema = z.enum(UrlMatchType);
export const experimentStatusSchema = z.enum(ExperimentStatus);
export const primaryMetricSchema = z.enum(PrimaryMetric);

/**
 * An arm's share of the traffic entered into the experiment, relative to the other arms.
 * `0` is allowed — it parks an arm without deleting it — but the schema rejects a set where
 * *every* arm is 0, since that leaves no arm to draw and nothing to divide by.
 */
export const armWeightSchema = z
  .number()
  .int("Must be a whole number")
  .min(0, "Cannot be negative")
  .max(100, "Must be at most 100");

/** One redirect target. `id` is present when editing an existing variant, absent for a new
 * one — that's what lets the service tell "update this row" from "create this row" apart. */
export const experimentVariantSchema = z.object({
  id: idSchema.optional(),
  url: absoluteUrlSchema,
  weight: armWeightSchema.default(50),
});

const experimentFields = z.object({
  websiteId: idSchema,
  name: displayNameSchema,
  description: z.string().trim().max(500, "Must be 500 characters or fewer").optional(),

  controlUrl: absoluteUrlSchema,
  controlMatchType: urlMatchTypeSchema.default("EXACT"),
  controlWeight: armWeightSchema.default(50),
  variants: z.array(experimentVariantSchema).min(1, "At least one variant is required"),

  /** Label for the goal. Optional — the UI falls back to the experiment's name. */
  conversionName: z.string().trim().max(120, "Must be 120 characters or fewer").optional(),
  conversionUrl: absoluteUrlSchema,
  conversionMatchType: urlMatchTypeSchema.default("EXACT"),
  primaryMetric: primaryMetricSchema.default("CONVERSION_RATE"),

  trafficAllocation: trafficAllocationSchema.default(100),
});

/**
 * Cross-field rules that prevent an experiment from being unable to produce a meaningful
 * result. Each of these is a configuration mistake that looks fine field-by-field:
 *
 *  - control === a variant would redirect a visitor to the page they are already on, which the
 *    SDK's loop guard would suppress, silently starving that arm.
 *  - two variants sharing a URL is the same mistake between two arms instead of one — a
 *    duplicate redirect target that can never be told apart in results.
 *  - conversion === control converts every control visitor on arrival, pinning that arm at
 *    100% and making the comparison meaningless.
 *  - conversion === a variant does the same to that arm.
 */
function applyUrlRules<
  T extends z.ZodType<{
    controlUrl: string;
    controlWeight: number;
    variants: { url: string; weight: number }[];
    conversionUrl: string;
  }>,
>(schema: T) {
  return schema.superRefine((value, ctx) => {
    // Every arm parked at 0 leaves no arm to draw and nothing to normalise against — the one
    // weight combination that cannot produce an experiment at all.
    const totalWeight =
      value.controlWeight + value.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["controlWeight"],
        message: "At least one arm must receive some traffic",
      });
    }

    value.variants.forEach((variant, index) => {
      if (isSameUrl(value.controlUrl, variant.url)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "url"],
          message: "A variant URL must be different from the control URL",
        });
      }

      if (isSameUrl(value.conversionUrl, variant.url)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "url"],
          message: "A variant URL must be different from the conversion URL",
        });
      }

      const duplicateAt = value.variants.findIndex(
        (other, otherIndex) => otherIndex < index && isSameUrl(other.url, variant.url),
      );
      if (duplicateAt !== -1) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "url"],
          message: "Two variants can't point at the same URL",
        });
      }
    });

    if (isSameUrl(value.conversionUrl, value.controlUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["conversionUrl"],
        message: "The conversion URL must be different from the control URL",
      });
    }
  });
}

export const createExperimentSchema = applyUrlRules(experimentFields);

/**
 * Updates carry every URL field so the cross-field rules can be re-evaluated against the
 * complete result; the caller merges the stored experiment with the user's changes first.
 */
export const updateExperimentSchema = applyUrlRules(
  experimentFields.omit({ websiteId: true }).extend({ experimentId: idSchema }),
);

export const experimentIdSchema = z.object({
  experimentId: idSchema,
});

export const changeExperimentStatusSchema = z.object({
  experimentId: idSchema,
  status: experimentStatusSchema,
});

export type ExperimentVariantInput = z.infer<typeof experimentVariantSchema>;
export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentInput = z.infer<typeof updateExperimentSchema>;
export type ChangeExperimentStatusInput = z.infer<typeof changeExperimentStatusSchema>;
