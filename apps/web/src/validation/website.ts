import { z } from "zod";

import { displayNameSchema, domainSchema, idSchema } from "@/validation/common";

/** Input for creating a website. The public site id is generated server-side, never supplied. */
export const createWebsiteSchema = z.object({
  name: displayNameSchema,
  domain: domainSchema,
});

export const updateWebsiteSchema = z.object({
  websiteId: idSchema,
  name: displayNameSchema.optional(),
  domain: domainSchema.optional(),
});

export const websiteIdSchema = z.object({
  websiteId: idSchema,
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>;
