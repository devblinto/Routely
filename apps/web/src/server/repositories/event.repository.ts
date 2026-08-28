import "server-only";

import type { EventType, Prisma, Variant } from "@/generated/prisma/client";
import { type DbClient, db } from "@/server/db";

/**
 * Data access for the append-only event log.
 */

export interface EventRecordInput {
  websiteId: string;
  experimentId: string;
  visitorId: string;
  assignmentId: string;
  variant: Variant;
  type: EventType;
  url: string;
  durationMs?: number | null;
  occurredAt: Date;
}

/** Inserts a batch in one statement. Events are never updated, so a plain insert suffices. */
export function createEvents(
  events: EventRecordInput[],
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.event.createMany({ data: events });
}

export interface EventTotals {
  variant: Variant;
  type: EventType;
  count: number;
  totalDurationMs: number;
}

/**
 * Event counts and accumulated duration per (variant, type) for one experiment.
 *
 * This is the dashboard's primary aggregation: one grouped scan of the
 * `[experimentId, type, variant, occurredAt]` index yields page views and total visible time
 * for both arms at once, rather than a query per metric per arm.
 */
export async function aggregateEvents(
  experimentId: string,
  range?: { from: Date; to: Date },
  client: DbClient = db,
): Promise<EventTotals[]> {
  const rows = await client.event.groupBy({
    by: ["variant", "type"],
    where: {
      experimentId,
      ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
    },
    _count: { _all: true },
    _sum: { durationMs: true },
  });

  return rows.map((row) => ({
    variant: row.variant,
    type: row.type,
    count: row._count._all,
    totalDurationMs: row._sum.durationMs ?? 0,
  }));
}

/**
 * Page views per arm for one experiment.
 *
 * Served entirely by the `[experimentId, type, variant, occurredAt]` index, so it stays a
 * grouped count over the index rather than a scan of the events table.
 */
export async function countPageViewsByVariant(
  experimentId: string,
  range?: { from: Date; to: Date },
  client: DbClient = db,
): Promise<Record<Variant, number>> {
  const rows = await client.event.groupBy({
    by: ["variant"],
    where: {
      experimentId,
      type: "page_view",
      ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
    },
    _count: { _all: true },
  });

  const totals: Record<Variant, number> = { CONTROL: 0, VARIANT: 0 };
  for (const row of rows) {
    totals[row.variant] = row._count._all;
  }
  return totals;
}

/**
 * Distinct visitors who produced a page view, per arm.
 *
 * Deliberately distinct from the assignment count: an assignment means a visitor was bucketed,
 * while this means they actually loaded a page. The two differ when a visitor is assigned and
 * redirected away before the variant page reports anything, so having both makes that
 * discrepancy visible rather than hiding it inside one number.
 */
export async function countPageViewVisitorsByVariant(
  experimentId: string,
  range?: { from: Date; to: Date },
  client: DbClient = db,
): Promise<Record<Variant, number>> {
  const rows = await client.event.groupBy({
    by: ["variant", "visitorId"],
    where: {
      experimentId,
      type: "page_view",
      ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
    },
  });

  const totals: Record<Variant, number> = { CONTROL: 0, VARIANT: 0 };
  for (const row of rows) {
    totals[row.variant] += 1;
  }
  return totals;
}

/**
 * Total reported visible time per arm, in milliseconds.
 *
 * Time is reported by the SDK as deltas — each event carries only what accumulated since the
 * previous one — so summing them gives total visible time with no risk of double counting a
 * running total.
 */
export async function sumVisibleMsByVariant(
  experimentId: string,
  range?: { from: Date; to: Date },
  client: DbClient = db,
): Promise<Record<Variant, number>> {
  const rows = await client.event.groupBy({
    by: ["variant"],
    where: {
      experimentId,
      type: "time_on_page",
      ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
    },
    _sum: { durationMs: true },
  });

  const totals: Record<Variant, number> = { CONTROL: 0, VARIANT: 0 };
  for (const row of rows) {
    totals[row.variant] = row._sum.durationMs ?? 0;
  }
  return totals;
}

/** Most recent events for one experiment, for debugging an installation. */
export function listRecentEvents(experimentId: string, limit = 50, client: DbClient = db) {
  return client.event.findMany({
    where: { experimentId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

/**
 * Whether the tracking snippet has ever reported an event for this website.
 *
 * Backs the "pixel detected" state on the Get started guide: rather than a separate
 * installed/verified flag that could drift from reality, detection is derived from the one
 * thing that actually proves the snippet is running — an event arrived. Served by the
 * `[websiteId, createdAt]` index, so this is an index probe rather than a table scan.
 */
export async function hasEvents(websiteId: string, client: DbClient = db): Promise<boolean> {
  const event = await client.event.findFirst({
    where: { websiteId },
    select: { id: true },
  });

  return event !== null;
}

/**
 * Deletes events older than `cutoff` for one website. The retention sweep is not scheduled in
 * the MVP; this exists so the `[websiteId, createdAt]` index has the caller it was added for.
 */
export function deleteEventsBefore(
  websiteId: string,
  cutoff: Date,
  client: DbClient = db,
): Promise<Prisma.BatchPayload> {
  return client.event.deleteMany({
    where: { websiteId, createdAt: { lt: cutoff } },
  });
}
