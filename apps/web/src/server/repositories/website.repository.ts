import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma, Website } from "@/generated/prisma/client";
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

/** Counts the dashboard needs per website: total experiments, and how many are running. */
const WEBSITE_COUNTS = {
  _count: { select: { experiments: true } },
} satisfies Prisma.WebsiteInclude;

export type WebsiteWithCounts = Prisma.WebsiteGetPayload<{
  include: typeof WEBSITE_COUNTS;
}> & { activeExperiments: number };

/**
 * The dashboard list, with each website's experiment count.
 *
 * The count is requested as part of the same query rather than looked up per row: a list of
 * N websites would otherwise cost N+1 round trips, and the number grows with the customer.
 */
export async function listWebsitesWithCounts(
  userId: string,
  client: DbClient = db,
): Promise<WebsiteWithCounts[]> {
  const [websites, activeByWebsite] = await Promise.all([
    client.website.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: WEBSITE_COUNTS,
    }),
    // One grouped query for the running counts rather than a filtered relation count, which
    // Prisma renders as a correlated subquery per row. Two round trips total, regardless of
    // how many websites the user has.
    client.experiment.groupBy({
      by: ["websiteId"],
      where: { status: "ACTIVE", website: { userId } },
      _count: { _all: true },
    }),
  ]);

  const active = new Map(activeByWebsite.map((row) => [row.websiteId, row._count._all]));

  return websites.map((website) => ({
    ...website,
    activeExperiments: active.get(website.id) ?? 0,
  }));
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
  data: { userId: string; name: string; domain: string; publicSiteId: string },
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

export function deleteWebsite(
  websiteId: string,
  userId: string,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.website.deleteMany({
    where: { id: websiteId, userId },
  });
}

export function countExperiments(websiteId: string, client: DbClient = db): Promise<number> {
  return client.experiment.count({ where: { websiteId } });
}
