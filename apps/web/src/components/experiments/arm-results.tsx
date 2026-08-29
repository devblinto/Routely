import { TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import type { ArmStats } from "@/server/services/analytics.service";
import { cn } from "@/lib/utils";

/**
 * One arm of an experiment, as a column of metrics.
 *
 * The experiment's primary metric — conversion rate by default, or time on page / page views if
 * chosen instead — is given the most visual weight via `heroLabel`/`heroValue`/`heroHint`,
 * because it is the number the decision turns on. Every metric is still listed below it: the
 * choice only changes what is emphasised, not what is measured.
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
  heroLabel,
  heroValue,
  heroHint,
}: {
  label: string;
  url: string;
  /** Percentage of traffic sent to this arm. */
  share: number;
  stats: ArmStats;
  /** Whether this arm currently leads on the experiment's primary metric. Descriptive only. */
  leading?: boolean;
  /** Name of the experiment's primary metric, e.g. "Conversion rate". */
  heroLabel: string;
  /** The primary metric's formatted value for this arm. */
  heroValue: string;
  /** What the hero value is measured against, e.g. "42 of 120 assigned visitors". */
  heroHint: string;
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
          <p className="text-xs font-medium text-muted-foreground">{heroLabel}</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">{heroValue}</p>
          <p className="mt-1 text-xs text-muted-foreground">{heroHint}</p>
        </div>

        <dl className="divide-y divide-border/70 border-t border-border/70 pt-1">
          <MetricRow label="Conversion rate" value={formatPercent(stats.conversionRate)} />
          <MetricRow label="Assigned visitors" value={formatNumber(stats.assignedVisitors)} />
          <MetricRow label="Page views" value={formatNumber(stats.pageViews)} />
          <MetricRow
            label="Unique visitors"
            hint="(loaded a page)"
            value={formatNumber(stats.visitors)}
          />
          <MetricRow
            label="Page views per visitor"
            value={stats.viewsPerVisitor === null ? "—" : stats.viewsPerVisitor.toFixed(2)}
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
