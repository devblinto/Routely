import Link from "next/link";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Metric, MetricState } from "@/server/services/metrics.service";

/**
 * The metrics list.
 *
 * A metric row is an experiment's conversion goal, so every action on it leads back to that
 * experiment — there is nowhere else a goal can be viewed or changed, and pretending otherwise
 * would mean two places that disagree about what a conversion is.
 */

const STATE: Record<MetricState, { label: string; hint: string; tone: string }> = {
  collecting: {
    label: "Collecting",
    hint: "Recording conversions",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  },
  waiting: {
    label: "Waiting",
    hint: "Waiting for first conversion",
    tone: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  },
  paused: {
    label: "Paused",
    hint: "Its experiment is paused",
    tone: "bg-muted text-muted-foreground ring-border",
  },
  draft: {
    label: "Not live",
    hint: "Its experiment hasn't launched",
    tone: "bg-muted text-muted-foreground ring-border",
  },
  archived: {
    label: "Archived",
    hint: "Its experiment is archived",
    tone: "bg-muted text-muted-foreground ring-border",
  },
};

function typeLabel(metric: Metric): string {
  return metric.matchType === "PREFIX" ? "Pageview (Prefix)" : "Pageview (Exact)";
}

export function MetricsTable({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Metric
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Conversions (24h)
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {metrics.map((metric) => {
            const state = STATE[metric.state];

            return (
              <tr key={metric.experimentId} className="border-b border-border last:border-0">
                <td className="px-4 py-3.5 align-top">
                  <p className="font-medium">{metric.name}</p>
                  <p className="text-xs text-muted-foreground">{metric.websiteName}</p>
                </td>

                <td className="px-4 py-3.5 align-top">
                  <p className="flex items-center gap-1.5 text-sm">
                    <Eye className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {typeLabel(metric)}
                  </p>
                  {/* The goal URL is the metric's actual definition, so it sits directly under
                   * the type rather than being hidden behind the row. */}
                  <p className="mt-0.5 max-w-[26rem] truncate font-mono text-xs text-muted-foreground">
                    {metric.url}
                  </p>
                </td>

                <td className="px-4 py-3.5 text-right align-top">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatNumber(metric.conversions24h)}
                  </span>
                  {metric.conversionsTotal > 0 ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(metric.conversionsTotal)} all time
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3.5 align-top">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      state.tone,
                    )}
                  >
                    {state.label}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.lastConversionAt
                      ? `Last conversion ${formatDate(metric.lastConversionAt)}`
                      : state.hint}
                  </p>
                </td>

                <td className="px-4 py-3.5 align-top">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={routes.experiments.detail(metric.experimentId)}>
                        View
                        <span className="sr-only"> results for {metric.name}</span>
                      </Link>
                    </Button>
                    {/* Goals are edited inline on the experiment page — the same place the URL
                     * that defines them is set — so "Edit" goes there rather than opening a
                     * second editor over the same field. */}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`${routes.experiments.detail(metric.experimentId)}#settings`}>
                        Edit
                        <span className="sr-only"> the goal for {metric.name}</span>
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
