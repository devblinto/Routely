import "server-only";

import type { Experiment, ExperimentStatus, Prisma } from "@/generated/prisma/client";
import { type DbClient, db } from "@/server/db";

/**
 * Data access for experiments.
 *
 * Ownership is expressed one level up, through the parent website: `website: { userId }`
 * scopes a query to the signed-in user without the experiment table needing a userId column.
 */

const VARIANTS_INCLUDE = {
  variants: { orderBy: { position: "asc" as const } },
} satisfies Prisma.ExperimentInclude;

export type ExperimentWithVariants = Prisma.ExperimentGetPayload<{
  include: typeof VARIANTS_INCLUDE;
}>;

export type ExperimentWithWebsite = Prisma.ExperimentGetPayload<{
  include: { website: true } & typeof VARIANTS_INCLUDE;
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
    include: { website: true, ...VARIANTS_INCLUDE },
  });
}

/**
 * Active experiments for one website, as published to the browser by the config endpoint.
 * Deliberately keyed on the website id resolved from a public site id, never on a user.
 */
export function listActiveExperiments(
  websiteId: string,
  client: DbClient = db,
): Promise<ExperimentWithVariants[]> {
  return client.experiment.findMany({
    where: { websiteId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: VARIANTS_INCLUDE,
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

/**
 * Resolves an experiment during ingestion, confirming it belongs to the reporting website.
 * Includes variants so the caller can verify a claimed variant id actually belongs to this
 * experiment before trusting it.
 */
export function findActiveExperimentForWebsite(
  experimentId: string,
  websiteId: string,
  client: DbClient = db,
): Promise<ExperimentWithVariants | null> {
  return client.experiment.findFirst({
    where: { id: experimentId, websiteId, status: "ACTIVE" },
    include: VARIANTS_INCLUDE,
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
    include: { website: true, ...VARIANTS_INCLUDE },
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
    include: { website: true, ...VARIANTS_INCLUDE },
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

/**
 * Experiment counts per website for one user, split into total and currently running.
 *
 * One grouped query covering every website at once, rather than a count per row: the Get
 * started table lists them all, and a per-row query would scale with how many websites an
 * account has.
 */
export async function countExperimentsByWebsite(
  userId: string,
  client: DbClient = db,
): Promise<Map<string, { total: number; active: number }>> {
  const rows = await client.experiment.groupBy({
    by: ["websiteId", "status"],
    where: { website: { userId } },
    _count: { _all: true },
  });

  const totals = new Map<string, { total: number; active: number }>();

  for (const row of rows) {
    const entry = totals.get(row.websiteId) ?? { total: 0, active: 0 };
    entry.total += row._count._all;
    if (row.status === "ACTIVE") entry.active += row._count._all;
    totals.set(row.websiteId, entry);
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

/**
 * Reconciles an experiment's variant rows with a submitted list: existing rows missing from
 * `variants` are deleted, existing rows present are updated (url and position), and entries
 * without an id are created.
 *
 * Deliberately does not open its own transaction — `DbClient` omits `$transaction` precisely so
 * a caller (the service layer) composes this with the experiment's own field update atomically,
 * rather than this repository function deciding transaction boundaries on its own.
 */
export async function replaceVariants(
  experimentId: string,
  variants: { id?: string; url: string; weight: number }[],
  client: DbClient = db,
): Promise<void> {
  const existing = await client.experimentVariant.findMany({
    where: { experimentId },
    select: { id: true },
  });
  const submittedIds = new Set(variants.flatMap((variant) => (variant.id ? [variant.id] : [])));
  const toDelete = existing.map((row) => row.id).filter((id) => !submittedIds.has(id));

  if (toDelete.length > 0) {
    await client.experimentVariant.deleteMany({ where: { id: { in: toDelete } } });
  }

  for (const [index, variant] of variants.entries()) {
    const position = index + 1;
    if (variant.id) {
      await client.experimentVariant.update({
        where: { id: variant.id },
        data: { url: variant.url, weight: variant.weight, position },
      });
    } else {
      await client.experimentVariant.create({
        data: { experimentId, url: variant.url, weight: variant.weight, position },
      });
    }
  }
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
