import { TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import type { ArmStats } from "@/server/services/analytics.service";
import { cn } from "@/lib/utils";

/**
 * One arm of an experiment, as a column of metrics.
 *
 * The conversion rate is given the most visual weight because it is the number the decision
 * turns on; everything else is supporting detail that explains how it was arrived at. The
 * denominator is printed underneath it rather than left implicit — a rate without its
 * denominator is the easiest way to misread a small sample as a result.
 */

interface MetricRowProps {
  label: string;
  value: string;
  hint?: string;
}

function MetricRow({ label, value, hint }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">
        {label}
        {hint ? <span className="ml-1 text-xs opacity-70">{hint}</span> : null}
      </dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function ArmResults({
  label,
  url,
  share,
  stats,
  leading = false,
}: {
  label: string;
  url: string;
  /** Percentage of traffic sent to this arm. */
  share: number;
  stats: ArmStats;
  /** Whether this arm currently has the higher conversion rate. Descriptive only. */
  leading?: boolean;
}) {
  return (
    <Card className={cn(leading && "ring-primary/30")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{label}</span>
            <Badge variant="outline">{share}%</Badge>
          </div>
          {leading ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <TrendingUp className="size-3.5" aria-hidden />
              Currently higher
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground" title={url}>
          {url}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Conversion rate</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
            {formatPercent(stats.conversionRate)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.assignedVisitors === 0
              ? "No visitors assigned yet"
              : `${formatNumber(stats.conversions)} of ${formatNumber(
                  stats.assignedVisitors,
                )} assigned visitor${stats.assignedVisitors === 1 ? "" : "s"}`}
          </p>
        </div>

        <dl className="divide-y divide-border/70 border-t border-border/70 pt-1">
          <MetricRow label="Assigned visitors" value={formatNumber(stats.assignedVisitors)} />
          <MetricRow label="Page views" value={formatNumber(stats.pageViews)} />
          <MetricRow
            label="Unique visitors"
            hint="(loaded a page)"
            value={formatNumber(stats.visitors)}
          />
          <MetricRow
            label="Avg. time on page"
            hint="(approx.)"
            value={formatDuration(stats.avgVisibleMs)}
          />
          <MetricRow label="Conversions" value={formatNumber(stats.conversions)} />
        </dl>
      </CardContent>
    </Card>
  );
}
