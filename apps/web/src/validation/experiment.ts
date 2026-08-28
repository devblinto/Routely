import { z } from "zod";

import { ExperimentStatus, UrlMatchType } from "@/generated/prisma/enums";
import { isSameUrl } from "@/lib/url";
import {
  absoluteUrlSchema,
  displayNameSchema,
  idSchema,
  variantSplitSchema,
} from "@/validation/common";

export const urlMatchTypeSchema = z.enum(UrlMatchType);
export const experimentStatusSchema = z.enum(ExperimentStatus);

const experimentFields = z.object({
  websiteId: idSchema,
  name: displayNameSchema,
  description: z.string().trim().max(500, "Must be 500 characters or fewer").optional(),

  controlUrl: absoluteUrlSchema,
  controlMatchType: urlMatchTypeSchema.default("EXACT"),
  variantUrl: absoluteUrlSchema,

  conversionUrl: absoluteUrlSchema,
  conversionMatchType: urlMatchTypeSchema.default("EXACT"),

  variantSplit: variantSplitSchema.default(50),
});

/**
 * Cross-field rules that prevent an experiment from being unable to produce a meaningful
 * result. Each of these is a configuration mistake that looks fine field-by-field:
 *
 *  - control === variant would redirect a visitor to the page they are already on, which the
 *    SDK's loop guard would suppress, silently starving the variant arm.
 *  - conversion === control converts every control visitor on arrival, pinning that arm at
 *    100% and making the comparison meaningless.
 *  - conversion === variant does the same to the variant arm.
 */
function applyUrlRules<
  T extends z.ZodType<{
    controlUrl: string;
    variantUrl: string;
    conversionUrl: string;
  }>,
>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (isSameUrl(value.controlUrl, value.variantUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["variantUrl"],
        message: "The variant URL must be different from the control URL",
      });
    }

    if (isSameUrl(value.conversionUrl, value.controlUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["conversionUrl"],
        message: "The conversion URL must be different from the control URL",
      });
    }

    if (isSameUrl(value.conversionUrl, value.variantUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["conversionUrl"],
        message: "The conversion URL must be different from the variant URL",
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

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentInput = z.infer<typeof updateExperimentSchema>;
export type ChangeExperimentStatusInput = z.infer<typeof changeExperimentStatusSchema>;
