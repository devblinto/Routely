import "server-only";

import type { Assignment, Variant } from "@/generated/prisma/client";
import { type DbClient, db } from "@/server/db";

/**
 * Data access for assignments — the binding of a visitor to one arm of one experiment.
 */

/**
 * Returns the visitor's existing assignment, or creates it with the proposed variant.
 *
 * The upsert's `update` is deliberately a no-op on `variant`: once a visitor is bucketed the
 * arm is permanent. If a client ever reports a different variant — a cleared cache, a stale
 * tab, a tampered payload — the stored arm wins, so a visitor's history can never be split
 * across both sides of the experiment.
 */
export function ensureAssignment(
  experimentId: string,
  visitorId: string,
  variant: Variant,
  assignedAt: Date,
  client: DbClient = db,
): Promise<Assignment> {
  return client.assignment.upsert({
    where: { experimentId_visitorId: { experimentId, visitorId } },
    create: { experimentId, visitorId, variant, assignedAt },
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
 * Visitors per arm. Served entirely by the `[experimentId, variant]` index, so it stays a
 * count over the index rather than a scan of the table.
 */
export async function countAssignmentsByVariant(
  experimentId: string,
  range?: { from: Date; to: Date },
  client: DbClient = db,
): Promise<Record<Variant, number>> {
  const rows = await client.assignment.groupBy({
    by: ["variant"],
    where: {
      experimentId,
      // Filtered on the same window as the conversions counted against it. Leaving the
      // denominator unbounded while the numerator is windowed would understate every rate in
      // a date-ranged view — badly, for an experiment that has been running a long time.
      ...(range ? { assignedAt: { gte: range.from, lte: range.to } } : {}),
    },
    _count: { _all: true },
  });

  const totals: Record<Variant, number> = { CONTROL: 0, VARIANT: 0 };
  for (const row of rows) {
    totals[row.variant] = row._count._all;
  }
  return totals;
}
