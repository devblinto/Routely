import "server-only";

import type { Assignment } from "@/generated/prisma/client";
import { type DbClient, db } from "@/server/db";

/**
 * Data access for assignments — the binding of a visitor to one arm of one experiment.
 *
 * `variantId` is nullable: `null` is the control arm (no redirect target), a non-null value
 * references a specific `ExperimentVariant` row. See schema.prisma's header comment for why
 * control isn't a row of its own.
 */

/**
 * Returns the visitor's existing assignment, or creates it with the proposed arm.
 *
 * The upsert's `update` is deliberately a no-op on `variantId`: once a visitor is bucketed the
 * arm is permanent. If a client ever reports a different arm — a cleared cache, a stale tab, a
 * tampered payload — the stored arm wins, so a visitor's history can never be split across two
 * arms of the same experiment.
 */
export function ensureAssignment(
  experimentId: string,
  visitorId: string,
  variantId: string | null,
  assignedAt: Date,
  client: DbClient = db,
): Promise<Assignment> {
  return client.assignment.upsert({
    where: { experimentId_visitorId: { experimentId, visitorId } },
    create: { experimentId, visitorId, variantId, assignedAt },
    update: {},
  });
}

export function findAssignment(
  experimentId: string,
  visitorId: string,
  client: DbClient = db,
): Promise<Assignment | null> {
  return client.assignment.findUnique({
    where: { experimentId_visitorId: { experimentId, visitorId } },
  });
}

/**
 * Visitors per arm, keyed by variant id — `null` is the control arm. Served entirely by the
 * `[experimentId, variantId]` index, so it stays a count over the index rather than a scan.
 *
 * Returns a `Map` rather than a plain object: a plain object's keys are always strings, so a
 * `null` key would silently become the string `"null"` — a real footgun given how much this
 * data model leans on `null` meaning something specific.
 */
export async function countAssignmentsByVariant(
  experimentId: string,
  range?: { from: Date; to: Date },
  client: DbClient = db,
): Promise<Map<string | null, number>> {
  const rows = await client.assignment.groupBy({
    by: ["variantId"],
    where: {
      experimentId,
      // Filtered on the same window as the conversions counted against it. Leaving the
      // denominator unbounded while the numerator is windowed would understate every rate in
      // a date-ranged view — badly, for an experiment that has been running a long time.
      ...(range ? { assignedAt: { gte: range.from, lte: range.to } } : {}),
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.variantId, row._count._all]));
}
