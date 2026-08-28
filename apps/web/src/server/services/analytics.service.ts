import "server-only";

import type { Variant } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import * as assignmentRepo from "@/server/repositories/assignment.repository";
import * as conversionRepo from "@/server/repositories/conversion.repository";
import * as eventRepo from "@/server/repositories/event.repository";
import * as experimentRepo from "@/server/repositories/experiment.repository";
import type { DateRange } from "@/validation/common";

/**
 * Read-only analytics for an experiment.
 *
 * Every function takes `actorUserId` and resolves the experiment through the ownership chain
 * first, so a caller cannot read another customer's results by supplying an id — the same rule
 * as everywhere else, applied to reads that are otherwise easy to treat as harmless.
 *
 * Page views, visitor counts, approximate visible time and conversions are computed here.
 *
 * ## Visible time is approximate
 *
 * `avgVisibleMs` is derived from what a browser is willing to report, which is document
 * visibility — not attention. A tab left open on a monitor nobody is looking at counts; a
 * person reading carefully while the window sits behind another may not. Time after the last
 * beacon is lost entirely, so a crash or a force-quit truncates the measurement silently, and
 * that truncation is more likely on slower devices.
 *
 * It is meaningful **as a comparison between the two arms of one experiment**, because both
 * are measured the same way and the bias is shared. It is not a session-duration figure, and
 * presenting it as one — or comparing it against a number from another tool — would be wrong.
 * The UI must label it as approximate wherever it appears.
 */

export interface ArmStats {
  /** Visitors bucketed into this arm, whether or not they went on to load a page. */
  assignedVisitors: number;
  /** Distinct visitors who actually loaded a page. */
  visitors: number;
  /** Total page views, including repeat visits by the same visitor. */
  pageViews: number;
  /** Page views per visitor, or null when there is nothing to divide. */
  viewsPerVisitor: number | null;
  /** Total reported visible time, in milliseconds. Approximate — see the note above. */
  totalVisibleMs: number;
  /**
   * Approximate visible time per page view, in milliseconds, or null when nothing has been
   * recorded. Averaged over page views rather than visitors, because that is the unit the
   * measurement is taken in.
   */
  avgVisibleMs: number | null;
  /** Visitors who reached the experiment's goal. At most one per assignment. */
  conversions: number;
  /**
   * Conversions divided by **assigned** visitors, as a fraction — or null when nobody has been
   * assigned yet.
   *
   * The denominator is deliberately the assigned count rather than the visitors who loaded a
   * page. Everyone bucketed had the opportunity to convert, and using a smaller denominator
   * would quietly inflate the rate for whichever arm loses more visitors before its page
   * renders — which is precisely the difference a redirect test is measuring.
   */
  conversionRate: number | null;
}

export interface ExperimentStats {
  experimentId: string;
  control: ArmStats;
  variant: ArmStats;
  /**
   * Relative change in conversion rate, variant against control, as a fraction: `0.42` means
   * the variant converts 42% better. Null when it cannot be computed.
   *
   * **Relative, not absolute** — the difference between 5% and 7% is 2 percentage points but a
   * 40% improvement, and the two are read very differently. It is labelled accordingly
   * wherever it is shown.
   *
   * Null when the control rate is zero: dividing by it would produce Infinity, and "infinitely
   * better" is not a claim any amount of data supports. It is also null before either arm has
   * a rate at all.
   *
   * This is arithmetic on two observed rates, **not** a significance test. A lift computed
   * from a handful of conversions is mostly noise, which is why the UI hides it below a
   * minimum sample.
   */
  lift: number | null;
  /**
   * True when nothing at all has been recorded — drives the dashboard's empty state.
   *
   * Checks assignments and conversions as well as page views: an experiment can have bucketed
   * visitors, or even conversions, before any page view arrives, and reporting that as empty
   * would tell the customer their installation is not working when it is.
   */
  isEmpty: boolean;
}

function armStats(
  variant: Variant,
  assigned: Record<Variant, number>,
  visitors: Record<Variant, number>,
  views: Record<Variant, number>,
  visibleMs: Record<Variant, number>,
  conversions: Record<Variant, number>,
): ArmStats {
  const pageViews = views[variant];
  const uniqueVisitors = visitors[variant];
  const totalVisibleMs = visibleMs[variant];
  const assignedVisitors = assigned[variant];
  const converted = conversions[variant];

  return {
    assignedVisitors,
    visitors: uniqueVisitors,
    pageViews,
    viewsPerVisitor: uniqueVisitors > 0 ? pageViews / uniqueVisitors : null,
    totalVisibleMs,
    // Guarded on page views, not on the total: a page with zero reported time is a legitimate
    // zero, whereas dividing by zero views would invent a number from nothing.
    avgVisibleMs: pageViews > 0 ? totalVisibleMs / pageViews : null,
    conversions: converted,
    conversionRate: assignedVisitors > 0 ? converted / assignedVisitors : null,
  };
}

/**
 * Page view and visitor counts for both arms.
 *
 * The three underlying queries are independent, so they are issued together: the dashboard
 * waits for the slowest rather than the sum.
 */
export async function getExperimentStats(
  actorUserId: string,
  experimentId: string,
  range?: DateRange,
): Promise<ExperimentStats> {
  const experiment = await experimentRepo.findExperimentForUser(experimentId, actorUserId);
  if (!experiment) {
    throw notFound("That experiment does not exist.");
  }

  return computeStats(experiment.id, range);
}

/**
 * Stats for an experiment reached through a public share token.
 *
 * Takes no actor because the token *is* the authorisation, and the caller has already resolved
 * it. Kept as a separate, explicitly-named entry point rather than making `actorUserId`
 * optional: an optional owner check is one forgotten argument away from an unauthorised read,
 * whereas a differently-named function has to be chosen deliberately.
 */
export function getSharedExperimentStats(
  experimentId: string,
  range?: DateRange,
): Promise<ExperimentStats> {
  return computeStats(experimentId, range);
}

async function computeStats(experimentId: string, range?: DateRange): Promise<ExperimentStats> {
  const experiment = { id: experimentId };

  const [assigned, visitors, views, visibleMs, conversions] = await Promise.all([
    assignmentRepo.countAssignmentsByVariant(experiment.id, range),
    eventRepo.countPageViewVisitorsByVariant(experiment.id, range),
    eventRepo.countPageViewsByVariant(experiment.id, range),
    eventRepo.sumVisibleMsByVariant(experiment.id, range),
    conversionRepo.countConversionsByVariant(experiment.id, range),
  ]);

  const control = armStats("CONTROL", assigned, visitors, views, visibleMs, conversions);
  const variant = armStats("VARIANT", assigned, visitors, views, visibleMs, conversions);

  const recorded =
    control.assignedVisitors +
    variant.assignedVisitors +
    control.pageViews +
    variant.pageViews +
    control.conversions +
    variant.conversions;

  return {
    experimentId: experiment.id,
    control,
    variant,
    lift: relativeLift(control.conversionRate, variant.conversionRate),
    isEmpty: recorded === 0,
  };
}

/** Variant against control, as a fraction. Null wherever the division is not meaningful. */
export function relativeLift(
  controlRate: number | null,
  variantRate: number | null,
): number | null {
  if (controlRate === null || variantRate === null) return null;
  // A control that has never converted gives no baseline to improve on. Reporting an infinite
  // lift — or quietly substituting a large number — would be worse than reporting nothing.
  if (controlRate === 0) return null;
  return (variantRate - controlRate) / controlRate;
}

/**
 * Stats for many experiments at once, for the experiments list.
 *
 * Three grouped queries in total, regardless of how many experiments are listed — the
 * alternative, calling `getExperimentStats` per row, is a query per experiment per metric and
 * degrades as a customer accumulates tests.
 *
 * Only the metrics the list actually shows are computed: visitors, conversions and lift. Page
 * views and visible time are left to the detail page rather than fetched and discarded.
 */
export interface ExperimentSummary {
  experimentId: string;
  assignedVisitors: number;
  conversions: number;
  controlRate: number | null;
  variantRate: number | null;
  lift: number | null;
}

export async function getExperimentSummaries(
  actorUserId: string,
  experimentIds: string[],
  range?: DateRange,
): Promise<Map<string, ExperimentSummary>> {
  const summaries = new Map<string, ExperimentSummary>();
  if (experimentIds.length === 0) return summaries;

  // Ownership is enforced by scoping the aggregation itself, not by trusting the caller to
  // have filtered the ids: an id the actor does not own simply contributes no rows.
  const owned = { website: { userId: actorUserId } };

  const [assignments, conversions] = await Promise.all([
    db.assignment.groupBy({
      by: ["experimentId", "variant"],
      where: {
        experimentId: { in: experimentIds },
        experiment: owned,
        // Same window as the conversions below, so the rate's numerator and denominator
        // always describe the same period.
        ...(range ? { assignedAt: { gte: range.from, lte: range.to } } : {}),
      },
      _count: { _all: true },
    }),
    db.conversion.groupBy({
      by: ["experimentId", "variant"],
      where: {
        experimentId: { in: experimentIds },
        experiment: owned,
        ...(range ? { occurredAt: { gte: range.from, lte: range.to } } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const assigned = new Map<string, Record<Variant, number>>();
  const converted = new Map<string, Record<Variant, number>>();

  const blank = (): Record<Variant, number> => ({ CONTROL: 0, VARIANT: 0 });

  for (const row of assignments) {
    const entry = assigned.get(row.experimentId) ?? blank();
    entry[row.variant] = row._count._all;
    assigned.set(row.experimentId, entry);
  }

  for (const row of conversions) {
    const entry = converted.get(row.experimentId) ?? blank();
    entry[row.variant] = row._count._all;
    converted.set(row.experimentId, entry);
  }

  for (const experimentId of experimentIds) {
    const a = assigned.get(experimentId) ?? blank();
    const c = converted.get(experimentId) ?? blank();

    const controlRate = a.CONTROL > 0 ? c.CONTROL / a.CONTROL : null;
    const variantRate = a.VARIANT > 0 ? c.VARIANT / a.VARIANT : null;

    summaries.set(experimentId, {
      experimentId,
      assignedVisitors: a.CONTROL + a.VARIANT,
      conversions: c.CONTROL + c.VARIANT,
      controlRate,
      variantRate,
      lift: relativeLift(controlRate, variantRate),
    });
  }

  return summaries;
}
