import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma, SiteProtocol, Website } from "@/generated/prisma/client";
import { type DbClient, db } from "@/server/db";

/**
 * Data access for websites.
 *
 * Repositories own queries and nothing else — no authorization, no business rules. What makes
 * them safe is that every ownership-sensitive function takes `userId` and folds it into the
 * `where` clause, so a caller cannot accidentally omit the tenant filter.
 */

/** Length in bytes of the random component of a public site id. */
const PUBLIC_SITE_ID_BYTES = 16;

/**
 * Generates a public site id: `rt_` plus 32 hex characters (128 bits).
 *
 * The value is public by design — it ships in the page source of every installed snippet —
 * so this is not about secrecy. It uses `randomBytes` rather than `Math.random` because a
 * *guessable* id would let anyone append events to another customer's website, which would
 * corrupt their results even though it grants no read access.
 */
export function generatePublicSiteId(): string {
  return `rt_${randomBytes(PUBLIC_SITE_ID_BYTES).toString("hex")}`;
}

export function listWebsitesForUser(userId: string, client: DbClient = db): Promise<Website[]> {
  return client.website.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function findWebsiteForUser(
  websiteId: string,
  userId: string,
  client: DbClient = db,
): Promise<Website | null> {
  return client.website.findFirst({
    where: { id: websiteId, userId },
  });
}

/** Resolves the website a tracking request belongs to. Used by the public SDK endpoints. */
export function findWebsiteByPublicSiteId(
  publicSiteId: string,
  client: DbClient = db,
): Promise<Website | null> {
  return client.website.findUnique({
    where: { publicSiteId },
  });
}

export function createWebsite(
  data: {
    userId: string;
    name: string;
    domain: string;
    protocol: SiteProtocol;
    publicSiteId: string;
  },
  client: DbClient = db,
): Promise<Website> {
  return client.website.create({ data });
}

export function updateWebsite(
  websiteId: string,
  userId: string,
  data: Prisma.WebsiteUpdateInput,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  // updateMany rather than update: it accepts a non-unique where clause, which lets the
  // tenant filter participate in the write itself instead of relying on a prior read.
  return client.website.updateMany({
    where: { id: websiteId, userId },
    data,
  });
}

/**
 * Records that the snippet was seen on this website's pages.
 *
 * Scoped by owner like every other write here, so a websiteId from a form body cannot stamp
 * somebody else's record.
 */
export function markPixelVerified(
  websiteId: string,
  userId: string,
  at: Date,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.website.updateMany({
    where: { id: websiteId, userId },
    data: { pixelVerifiedAt: at },
  });
}

export function deleteWebsite(
  websiteId: string,
  userId: string,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.website.deleteMany({
    where: { id: websiteId, userId },
  });
}

/**
 * Deletes several websites belonging to one user. As with the single-row version, the tenant
 * filter participates in the write itself rather than relying on a prior read.
 */
export function deleteWebsites(
  websiteIds: string[],
  userId: string,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.website.deleteMany({
    where: { id: { in: websiteIds }, userId },
  });
}

export function countExperiments(websiteId: string, client: DbClient = db): Promise<number> {
  return client.experiment.count({ where: { websiteId } });
}
