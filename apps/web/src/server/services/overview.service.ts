import "server-only";

import { db } from "@/server/db";
import * as experimentRepo from "@/server/repositories/experiment.repository";

/**
 * Account-level figures for the Get started page.
 *
 * Every number here is derived, never stored: the same rule the rest of the app follows, so a
 * counter cannot drift away from the rows it claims to describe. See `DATABASE.md`.
 *
 * The whole thing is one service call rather than a handful of component-level queries,
 * because these cards sit above the fold on the page a signed-in customer lands on — six
 * independent round trips there would be six chances to make the first screen slow.
 */

/**
 * Tracked-visitor ceiling shown by the usage card.
 *
 * **There is no billing in Routely yet**, so this is not read from a plan — it is a single
 * assumed allowance, named here so that when plans do exist there is exactly one line to
 * replace with a lookup. It is deliberately not scattered through the component.
 */
export const TRACKED_USER_ALLOWANCE = 100_000;

/** Share of the allowance past which the usage card stops saying "on track". */
const USAGE_WARNING_RATIO = 0.8;

export interface OverviewStats {
  /** Distinct visitors first seen on this account's websites during the current month. */
  trackedUsers: number;
  trackedUserAllowance: number;
  /** `trackedUsers / allowance`, clamped to 1 so a bar cannot overflow its track. */
  usageRatio: number;
  usageOnTrack: boolean;

  liveExperiments: number;
  draftExperiments: number;

  /** Conversions recorded across the account this calendar year. */
  conversions: number;
  /** Visitors assigned an arm this calendar year — the denominator of every rate. */
  visitorsInExperiments: number;
  /** Mean relative change across experiments where one can be computed; `null` if none can. */
  averageUplift: number | null;
  /** How many experiments contributed to the totals above. */
  measuredExperiments: number;
  /** How many of those had enough data on both arms to produce an uplift. */
  upliftExperiments: number;
  /** Calendar year the performance figures cover. */
  year: number;
}

/** First instant of the current month, in the server's timezone. */
function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfYear(now: Date): Date {
  return new Date(now.getFullYear(), 0, 1);
}

export async function getOverviewStats(
  actorUserId: string,
  now: Date = new Date(),
): Promise<OverviewStats> {
  // Conversions and assignments reach their owner through the experiment, never directly:
  // neither table carries a websiteId. Scoping the aggregation this way is what enforces
  // ownership — an experiment the actor does not own contributes no rows rather than being
  // filtered out afterwards.
  const ownedExperiment = { experiment: { website: { userId: actorUserId } } };
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const [trackedUsers, statusCounts, conversions, assignmentsByExperiment] = await Promise.all([
    // `firstSeenAt`, not `lastSeenAt`: the card counts people who *started* being tracked in
    // this cycle. Counting by last activity would re-count a returning visitor every month and
    // make the figure grow without anyone new arriving.
    db.visitor.count({
      where: { website: { userId: actorUserId }, firstSeenAt: { gte: monthStart } },
    }),
    experimentRepo.countExperimentsByStatus(actorUserId),
    db.conversion.count({ where: { ...ownedExperiment, occurredAt: { gte: yearStart } } }),
    // Grouped by arm so the uplift can be computed per experiment; a plain count would give
    // the totals but lose the control/variant split that a comparison needs.
    db.assignment.groupBy({
      by: ["experimentId", "variantId"],
      where: { ...ownedExperiment, assignedAt: { gte: yearStart } },
      _count: { _all: true },
    }),
  ]);

  const experimentIds = [...new Set(assignmentsByExperiment.map((row) => row.experimentId))];

  const conversionsByArm =
    experimentIds.length > 0
      ? await db.conversion.groupBy({
          by: ["experimentId", "variantId"],
          where: {
            experimentId: { in: experimentIds },
            ...ownedExperiment,
            occurredAt: { gte: yearStart },
          },
          _count: { _all: true },
        })
      : [];

  const assigned = new Map<string, Map<string | null, number>>();
  for (const row of assignmentsByExperiment) {
    const inner = assigned.get(row.experimentId) ?? new Map<string | null, number>();
    inner.set(row.variantId, row._count._all);
    assigned.set(row.experimentId, inner);
  }

  const converted = new Map<string, Map<string | null, number>>();
  for (const row of conversionsByArm) {
    const inner = converted.get(row.experimentId) ?? new Map<string | null, number>();
    inner.set(row.variantId, row._count._all);
    converted.set(row.experimentId, inner);
  }

  let visitorsInExperiments = 0;
  const lifts: number[] = [];

  for (const [experimentId, arms] of assigned) {
    for (const count of arms.values()) visitorsInExperiments += count;

    const armConversions = converted.get(experimentId) ?? new Map<string | null, number>();
    const controlAssigned = arms.get(null) ?? 0;
    if (controlAssigned === 0) continue;

    const controlRate = (armConversions.get(null) ?? 0) / controlAssigned;
    // A control that converted nobody has no rate to improve *on* — the relative change would
    // divide by zero and read as infinite, which is not a result anyone should be shown.
    if (controlRate === 0) continue;

    let bestRate: number | null = null;
    for (const [variantId, variantAssigned] of arms) {
      if (variantId === null || variantAssigned === 0) continue;
      const rate = (armConversions.get(variantId) ?? 0) / variantAssigned;
      if (bestRate === null || rate > bestRate) bestRate = rate;
    }

    if (bestRate !== null) lifts.push((bestRate - controlRate) / controlRate);
  }

  const usageRatio =
    TRACKED_USER_ALLOWANCE > 0 ? Math.min(trackedUsers / TRACKED_USER_ALLOWANCE, 1) : 0;

  return {
    trackedUsers,
    trackedUserAllowance: TRACKED_USER_ALLOWANCE,
    usageRatio,
    usageOnTrack: usageRatio < USAGE_WARNING_RATIO,

    liveExperiments: statusCounts.ACTIVE,
    draftExperiments: statusCounts.DRAFT,

    conversions,
    visitorsInExperiments,
    averageUplift:
      lifts.length > 0 ? lifts.reduce((sum, value) => sum + value, 0) / lifts.length : null,
    measuredExperiments: experimentIds.length,
    upliftExperiments: lifts.length,
    year: now.getFullYear(),
  };
}
