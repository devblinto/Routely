import { BarChart3, Info } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ArmResults } from "@/components/experiments/arm-results";
import { LiftBadge } from "@/components/experiments/lift-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { PrimaryMetric } from "@/generated/prisma/enums";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import type { ArmStats } from "@/server/services/analytics.service";

/**
 * Control against every variant.
 *
 * ## Why there is no significance test here
 *
 * A p-value or a confidence interval would be the honest way to say "this difference is real",
 * and computing one is not the hard part — choosing it correctly is. A test run continuously
 * and read whenever the numbers look good is wrong regardless of the statistics behind it
 * (the peeking problem), and a badly-chosen test lends false authority to exactly the mistake
 * it appears to prevent.
 *
 * So this shows which arm is *currently* ahead and says plainly that it is not proof. A
 * descriptive statement a reader can weigh is better than an inferential one they will trust
 * more than it deserves.
 */

/** One redirect target's results, already zipped with its url/label/share by the caller. */
export interface VariantResult {
  variantId: string;
  url: string;
  /** "Variant 1", "Variant 2"… derived from position, not stored anywhere. */
  label: string;
  /** Percentage of total site traffic sent to this arm. */
  share: number;
  stats: ArmStats;
}

/**
 * Below this many assigned visitors per arm, the comparison is not worth reading at all.
 *
 * Not a significance threshold — there is no test here. It is the point below which random
 * variation dominates so completely that showing a leader would mislead: with 20 visitors an
 * arm, a single conversion swings the rate by five points.
 */
const MIN_VISITORS_FOR_COMPARISON = 30;

/**
 * What "currently ahead" is judged on. Every metric is always collected regardless of an
 * experiment's `primaryMetric` — this only selects which one the leader alert reads from.
 */
const METRIC_META: Record<
  PrimaryMetric,
  {
    /** Lower-case, for inline sentences: "…is currently leading on {label}". */
    label: string;
    /** Title-case, for the arm card's own heading. */
    heroLabel: string;
    extract: (stats: ArmStats) => number | null;
    format: (value: number | null) => string;
    hint: (stats: ArmStats) => string;
  }
> = {
  CONVERSION_RATE: {
    label: "conversion rate",
    heroLabel: "Conversion rate",
    extract: (stats) => stats.conversionRate,
    format: formatPercent,
    hint: (stats) =>
      stats.assignedVisitors === 0
        ? "No visitors assigned yet"
        : `${formatNumber(stats.conversions)} of ${formatNumber(stats.assignedVisitors)} assigned visitor${stats.assignedVisitors === 1 ? "" : "s"}`,
  },
  TIME_ON_PAGE: {
    label: "average time on page",
    heroLabel: "Avg. time on page",
    extract: (stats) => stats.avgVisibleMs,
    format: formatDuration,
    hint: (stats) =>
      stats.pageViews === 0
        ? "No page views yet"
        : `Across ${formatNumber(stats.pageViews)} page view${stats.pageViews === 1 ? "" : "s"} (approx.)`,
  },
  PAGE_VIEWS: {
    label: "page views per visitor",
    heroLabel: "Page views per visitor",
    extract: (stats) => stats.viewsPerVisitor,
    format: (value) => (value === null ? "—" : value.toFixed(2)),
    hint: (stats) =>
      stats.visitors === 0
        ? "No visitors yet"
        : `${formatNumber(stats.pageViews)} page views across ${formatNumber(stats.visitors)} visitor${stats.visitors === 1 ? "" : "s"}`,
  },
};

/** Same formula as `analytics.service.ts`'s `relativeLift`, generalised to any metric here so
 * the leader alert can describe whichever one is primary, not only conversion rate. */
function relativeChange(control: number | null, variant: number | null): number | null {
  if (control === null || variant === null) return null;
  if (control === 0) return null;
  return (variant - control) / control;
}

interface Arm {
  /** `null` is control; a variant's id otherwise. */
  key: string | null;
  label: string;
  url: string;
  /** Percentage of total site traffic sent to this arm. */
  share: number;
  stats: ArmStats;
}

export function ExperimentResults({
  control,
  controlShare,
  variants,
  isEmpty,
  controlUrl,
  primaryMetric,
  isDraft,
}: {
  control: ArmStats;
  /** Percentage of total site traffic left on the control page. */
  controlShare: number;
  variants: VariantResult[];
  isEmpty: boolean;
  controlUrl: string;
  primaryMetric: PrimaryMetric;
  isDraft: boolean;
}) {
  if (isEmpty) {
    return (
      <EmptyState
        icon={BarChart3}
        title={isDraft ? "No results yet" : "Waiting for the first visitors"}
        description={
          isDraft
            ? "Publish the experiment and make sure the tracking snippet is installed on every page to start collecting results."
            : "Results appear here once visitors reach the control page with the snippet installed. If nothing arrives, check the snippet is present on the control, variant and conversion pages."
        }
      />
    );
  }

  const arms: Arm[] = [
    { key: null, label: "Control", url: controlUrl, share: controlShare, stats: control },
    ...variants.map((variant) => ({
      key: variant.variantId,
      label: variant.label,
      url: variant.url,
      share: variant.share,
      stats: variant.stats,
    })),
  ];

  const meta = METRIC_META[primaryMetric];
  const extracted = arms.map((arm) => ({ arm, value: meta.extract(arm.stats) }));
  const smallSample = arms.some((arm) => arm.stats.assignedVisitors < MIN_VISITORS_FOR_COMPARISON);

  // A leader is only named once every arm has enough traffic, has actually recorded this
  // metric, and is not tied with another arm for the top value — otherwise the difference is
  // noise wearing a number's clothes, or there is nothing to call a "leader" at all.
  let leadingArm: Arm | null = null;
  if (!smallSample && extracted.every((entry) => entry.value !== null)) {
    const max = Math.max(...extracted.map((entry) => entry.value as number));
    const winners = extracted.filter((entry) => entry.value === max);
    if (winners.length === 1) leadingArm = winners[0]!.arm;
  }

  return (
    <div className="space-y-4">
      {leadingArm ? (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>
            {leadingArm.key === null ? "Control" : leadingArm.label} is currently leading on{" "}
            {meta.label}
          </AlertTitle>
          <AlertDescription>
            {meta.format(meta.extract(leadingArm.stats))}
            {leadingArm.key !== null ? (
              <>
                {" "}
                against {meta.format(meta.extract(control))} (
                <LiftBadge
                  lift={relativeChange(meta.extract(control), meta.extract(leadingArm.stats))}
                  className="align-middle"
                />{" "}
                relative to control)
              </>
            ) : null}
            . This is a description of the numbers so far, <strong>not statistical proof</strong>.
            Routely does not test for significance, and a lead can reverse as more visitors
            arrive — so treat it as a signal to keep watching, not a result to act on.
          </AlertDescription>
        </Alert>
      ) : null}

      {smallSample ? (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>Too little traffic to compare yet</AlertTitle>
          <AlertDescription>
            With fewer than {MIN_VISITORS_FOR_COMPARISON} visitors in an arm, a single conversion
            moves the rate by several points. The numbers below are accurate; the comparison between
            them is not yet meaningful.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {arms.map((arm) => (
          <ArmResults
            key={arm.key ?? "control"}
            label={arm.label}
            url={arm.url}
            share={arm.share}
            stats={arm.stats}
            leading={leadingArm?.key === arm.key}
            heroLabel={meta.heroLabel}
            heroValue={meta.format(meta.extract(arm.stats))}
            heroHint={meta.hint(arm.stats)}
          />
        ))}
      </div>

      <p className="text-xs text-pretty text-muted-foreground">
        Conversion rate is conversions divided by assigned visitors. Average time on page is
        approximate — it measures how long the browser reported the page as visible, which is not
        the same as attention, and is comparable between arms but not against other tools. The
        percentage on each arm is its share of total site traffic. Relative change compares a
        variant&rsquo;s rate with control&rsquo;s — it is arithmetic, not a significance test.
      </p>
    </div>
  );
}
