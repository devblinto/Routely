import { BarChart3, Info } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ArmResults } from "@/components/experiments/arm-results";
import { LiftBadge } from "@/components/experiments/lift-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatPercent } from "@/lib/format";
import type { ExperimentStats } from "@/server/services/analytics.service";

/**
 * Control against variant.
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

/**
 * Below this many assigned visitors per arm, the comparison is not worth reading at all.
 *
 * Not a significance threshold — there is no test here. It is the point below which random
 * variation dominates so completely that showing a leader would mislead: with 20 visitors an
 * arm, a single conversion swings the rate by five points.
 */
const MIN_VISITORS_FOR_COMPARISON = 30;

function leader(stats: ExperimentStats): "control" | "variant" | null {
  const { control, variant } = stats;

  if (control.conversionRate === null || variant.conversionRate === null) return null;
  if (control.conversionRate === variant.conversionRate) return null;

  return control.conversionRate > variant.conversionRate ? "control" : "variant";
}

export function ExperimentResults({
  stats,
  controlUrl,
  variantUrl,
  variantSplit,
  isDraft,
}: {
  stats: ExperimentStats;
  controlUrl: string;
  variantUrl: string;
  variantSplit: number;
  isDraft: boolean;
}) {
  if (stats.isEmpty) {
    return (
      <EmptyState
        icon={BarChart3}
        title={isDraft ? "No results yet" : "Waiting for the first visitors"}
        description={
          isDraft
            ? "Publish the experiment and make sure the tracking snippet is installed on all three pages to start collecting results."
            : "Results appear here once visitors reach the control page with the snippet installed. If nothing arrives, check the snippet is present on the control, variant and conversion pages."
        }
      />
    );
  }

  const ahead = leader(stats);
  const smallSample =
    stats.control.assignedVisitors < MIN_VISITORS_FOR_COMPARISON ||
    stats.variant.assignedVisitors < MIN_VISITORS_FOR_COMPARISON;

  // A leader is only named once both arms have enough traffic for the comparison to be worth
  // reading at all. Below that the difference is noise wearing a number's clothes.
  const showLeader = ahead !== null && !smallSample;

  return (
    <div className="space-y-4">
      {showLeader ? (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>
            {ahead === "variant" ? "Variant" : "Control"} is currently converting higher
          </AlertTitle>
          <AlertDescription>
            {formatPercent(
              ahead === "variant" ? stats.variant.conversionRate : stats.control.conversionRate,
            )}{" "}
            against{" "}
            {formatPercent(
              ahead === "variant" ? stats.control.conversionRate : stats.variant.conversionRate,
            )}{" "}
            (<LiftBadge lift={stats.lift} className="align-middle" /> relative change). This is a
            description of the numbers so far, <strong>not statistical proof</strong>. Routely does
            not test for significance, and a lead can reverse as more visitors arrive — so treat it
            as a signal to keep watching, not a result to act on.
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ArmResults
          label="Control"
          url={controlUrl}
          share={100 - variantSplit}
          stats={stats.control}
          leading={showLeader && ahead === "control"}
        />
        <ArmResults
          label="Variant"
          url={variantUrl}
          share={variantSplit}
          stats={stats.variant}
          leading={showLeader && ahead === "variant"}
        />
      </div>

      <p className="text-xs text-pretty text-muted-foreground">
        Conversion rate is conversions divided by assigned visitors. Average time on page is
        approximate — it measures how long the browser reported the page as visible, which is not
        the same as attention, and is comparable between these two arms but not against other tools.
        Relative change compares the variant&rsquo;s rate with the control&rsquo;s — it is
        arithmetic, not a significance test.
      </p>
    </div>
  );
}
