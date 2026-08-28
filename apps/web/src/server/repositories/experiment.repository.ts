import "server-only";

import type { Experiment, ExperimentStatus, Prisma } from "@/generated/prisma/client";
import { type DbClient, db } from "@/server/db";

/**
 * Data access for experiments.
 *
 * Ownership is expressed one level up, through the parent website: `website: { userId }`
 * scopes a query to the signed-in user without the experiment table needing a userId column.
 */

export type ExperimentWithWebsite = Prisma.ExperimentGetPayload<{
  include: { website: true };
}>;

export function listExperimentsForWebsite(
  websiteId: string,
  userId: string,
  client: DbClient = db,
): Promise<Experiment[]> {
  return client.experiment.findMany({
    where: { websiteId, website: { userId } },
    orderBy: { createdAt: "desc" },
  });
}

export function findExperimentForUser(
  experimentId: string,
  userId: string,
  client: DbClient = db,
): Promise<ExperimentWithWebsite | null> {
  return client.experiment.findFirst({
    where: { id: experimentId, website: { userId } },
    include: { website: true },
  });
}

/**
 * Active experiments for one website, as published to the browser by the config endpoint.
 * Deliberately keyed on the website id resolved from a public site id, never on a user.
 */
export function listActiveExperiments(
  websiteId: string,
  client: DbClient = db,
): Promise<Experiment[]> {
  return client.experiment.findMany({
    where: { websiteId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Active experiments on a website, optionally ignoring one.
 *
 * Used for conflict detection: `excludeId` lets an experiment be checked against its peers
 * without matching itself when it is already active and being re-validated.
 */
export function listActiveExperimentsExcluding(
  websiteId: string,
  excludeId: string | undefined,
  client: DbClient = db,
): Promise<Experiment[]> {
  return client.experiment.findMany({
    where: {
      websiteId,
      status: "ACTIVE",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/** Resolves an experiment during ingestion, confirming it belongs to the reporting website. */
export function findActiveExperimentForWebsite(
  experimentId: string,
  websiteId: string,
  client: DbClient = db,
): Promise<Experiment | null> {
  return client.experiment.findFirst({
    where: { id: experimentId, websiteId, status: "ACTIVE" },
  });
}

/**
 * Resolves an experiment by its public share token.
 *
 * Unscoped by user by design — the token is the credential. It is looked up on a unique index,
 * so an invalid token costs one index probe and reveals nothing.
 */
export function findExperimentByShareToken(
  shareToken: string,
  client: DbClient = db,
): Promise<ExperimentWithWebsite | null> {
  return client.experiment.findUnique({
    where: { shareToken },
    include: { website: true },
  });
}

export interface ExperimentQuery {
  status?: ExperimentStatus;
  /** Case-insensitive substring match on the name. */
  search?: string;
}

/**
 * Every experiment the user owns, across all their websites, newest first.
 *
 * Filtering happens in the query rather than in memory: a customer with many experiments
 * should not transfer all of them to render a filtered list, and the `[websiteId, createdAt]`
 * index keeps the ordering cheap.
 */
export function listExperimentsForUser(
  userId: string,
  query: ExperimentQuery = {},
  client: DbClient = db,
): Promise<ExperimentWithWebsite[]> {
  return client.experiment.findMany({
    where: {
      website: { userId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { website: true },
  });
}

/** How many experiments the user has in each status, for the tab counts. */
export async function countExperimentsByStatus(
  userId: string,
  client: DbClient = db,
): Promise<Record<ExperimentStatus, number>> {
  const rows = await client.experiment.groupBy({
    by: ["status"],
    where: { website: { userId } },
    _count: { _all: true },
  });

  const totals: Record<ExperimentStatus, number> = {
    DRAFT: 0,
    ACTIVE: 0,
    PAUSED: 0,
    ARCHIVED: 0,
  };
  for (const row of rows) {
    totals[row.status] = row._count._all;
  }
  return totals;
}

export function createExperiment(
  data: Prisma.ExperimentUncheckedCreateInput,
  client: DbClient = db,
): Promise<Experiment> {
  return client.experiment.create({ data });
}

export function updateExperiment(
  experimentId: string,
  userId: string,
  data: Prisma.ExperimentUpdateInput,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.experiment.updateMany({
    where: { id: experimentId, website: { userId } },
    data,
  });
}

export function deleteExperiment(
  experimentId: string,
  userId: string,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.experiment.deleteMany({
    where: { id: experimentId, website: { userId } },
  });
}
