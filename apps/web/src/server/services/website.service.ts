import "server-only";

import type { Website } from "@/generated/prisma/client";
import { Prisma } from "@/server/db";
import { conflict, notFound } from "@/server/errors";
import * as websiteRepo from "@/server/repositories/website.repository";
import { parseOrThrow } from "@/server/validate";
import { createWebsiteSchema, updateWebsiteSchema } from "@/validation/website";

/**
 * Website business logic.
 *
 * Every function takes `actorUserId` as its first argument and passes it into the repository,
 * so authorization is structural rather than remembered: there is no code path that reads or
 * writes a website without a tenant filter. Anything the actor does not own reports
 * "not found" rather than "forbidden", so an id cannot be probed for existence.
 */

/** Retries for the astronomically unlikely case of a public site id collision. */
const PUBLIC_SITE_ID_ATTEMPTS = 3;

export function listWebsites(actorUserId: string): Promise<Website[]> {
  return websiteRepo.listWebsitesForUser(actorUserId);
}

/** The dashboard list: the actor's websites, newest first, each with its experiment count. */
export function listWebsitesWithCounts(
  actorUserId: string,
): Promise<websiteRepo.WebsiteWithCounts[]> {
  return websiteRepo.listWebsitesWithCounts(actorUserId);
}

/** Number of experiments on a website the actor owns. Used by the delete confirmation. */
export async function countExperiments(actorUserId: string, websiteId: string): Promise<number> {
  await getWebsite(actorUserId, websiteId);
  return websiteRepo.countExperiments(websiteId);
}

export async function getWebsite(actorUserId: string, websiteId: string): Promise<Website> {
  const website = await websiteRepo.findWebsiteForUser(websiteId, actorUserId);

  if (!website) {
    throw notFound("That website does not exist.");
  }

  return website;
}

export async function createWebsite(actorUserId: string, input: unknown): Promise<Website> {
  const data = parseOrThrow(createWebsiteSchema, input, "Check the website details.");

  for (let attempt = 0; attempt < PUBLIC_SITE_ID_ATTEMPTS; attempt += 1) {
    try {
      return await websiteRepo.createWebsite({
        userId: actorUserId,
        name: data.name,
        domain: data.domain,
        publicSiteId: websiteRepo.generatePublicSiteId(),
      });
    } catch (error) {
      if (isUniqueViolation(error, "publicSiteId")) {
        continue;
      }
      throw error;
    }
  }

  throw conflict("Could not allocate a public site id. Please try again.");
}

export async function updateWebsite(actorUserId: string, input: unknown): Promise<Website> {
  const { websiteId, ...changes } = parseOrThrow(
    updateWebsiteSchema,
    input,
    "Check the website details.",
  );

  const result = await websiteRepo.updateWebsite(websiteId, actorUserId, changes);

  if (result.count === 0) {
    throw notFound("That website does not exist.");
  }

  return getWebsite(actorUserId, websiteId);
}

export async function deleteWebsite(actorUserId: string, websiteId: string): Promise<void> {
  const result = await websiteRepo.deleteWebsite(websiteId, actorUserId);

  if (result.count === 0) {
    throw notFound("That website does not exist.");
  }
}

/**
 * Issues a new public site id. This invalidates every already-installed snippet for the
 * website, so it is an explicit action rather than a side effect of editing details.
 */
export async function rotatePublicSiteId(actorUserId: string, websiteId: string): Promise<Website> {
  await getWebsite(actorUserId, websiteId);

  await websiteRepo.updateWebsite(websiteId, actorUserId, {
    publicSiteId: websiteRepo.generatePublicSiteId(),
  });

  return getWebsite(actorUserId, websiteId);
}

/**
 * Resolves the website behind a public site id for the unauthenticated SDK endpoints. Returns
 * null rather than throwing: an unknown id is a normal condition on a public endpoint, not an
 * exceptional one.
 */
export function resolveWebsiteByPublicSiteId(publicSiteId: string): Promise<Website | null> {
  return websiteRepo.findWebsiteByPublicSiteId(publicSiteId);
}

function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : target === field;
}
