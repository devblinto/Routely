import { z } from "zod";

import { SiteProtocol } from "@/generated/prisma/enums";
import { absoluteUrlSchema, displayNameSchema, domainSchema, idSchema } from "@/validation/common";

/** Scheme the site is served over. Defaults to https — http is the local-development case. */
export const siteProtocolSchema = z.enum(SiteProtocol).default("HTTPS");

/** Input for creating a website. The public site id is generated server-side, never supplied. */
export const createWebsiteSchema = z.object({
  name: displayNameSchema,
  domain: domainSchema,
  protocol: siteProtocolSchema,
});

export const updateWebsiteSchema = z.object({
  websiteId: idSchema,
  name: displayNameSchema.optional(),
  domain: domainSchema.optional(),
  protocol: siteProtocolSchema.optional(),
});

export const websiteIdSchema = z.object({
  websiteId: idSchema,
});

/** Input for the install check: which website, and which of its pages to look at. */
export const verifyInstallationSchema = z.object({
  websiteId: idSchema,
  url: absoluteUrlSchema,
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>;
