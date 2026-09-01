import Link from "next/link";
import { ArrowRight, Hourglass, Info, PenLine, TrendingUp, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { OverviewStats } from "@/server/services/overview.service";

/**
 * The two rows of figures above the websites table: where the account stands this cycle, and
 * what its experiments have produced this year.
 *
 * Every number is derived from rows at request time — see `overview.service.ts`. The one thing
 * that is *not* measured is the tracked-user allowance, because Routely has no billing yet;
 * it is a named constant in the service, and this component only renders it.
 */

function Stat({
  icon: Icon,
  tone,
  title,
  value,
  unit,
  action,
  footnote,
  children,
  className,
}: {
  icon: typeof User;
  tone: "blue" | "amber" | "green";
  title: string;
  value: string;
  unit: string;
  action?: React.ReactNode;
  footnote: string;
  children?: React.ReactNode;
  className?: string;
}) {
  // Icon tints only, and deliberately not brand colours: they distinguish three cards at a
  // glance, while the brand stays reserved for things you can act on.
  const tones = {
    blue: "bg-muted text-muted-foreground",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  } as const;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 p-5", className)}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn("grid size-7 shrink-0 place-items-center rounded-md", tones[tone])}
        >
          <Icon className="size-4" />
        </span>
        <h3 className="truncate text-sm font-semibold">{title}</h3>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </p>
        {action}
      </div>

      {children}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span className="min-w-0">{footnote}</span>
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  footnote,
  className,
}: {
  icon: typeof User;
  label: string;
  value: string;
  footnote: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 p-5", className)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="truncate text-sm font-medium">{label}</h3>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{footnote}</span>
      </div>
    </div>
  );
}

/** "2 experiments" / "1 experiment" — the counts under the performance figures. */
function experimentCount(n: number): string {
  return `${formatNumber(n)} experiment${n === 1 ? "" : "s"}`;
}

/** Mean relative change, signed, or a dash when nothing could be measured. */
function formatUplift(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function OverviewCards({ stats }: { stats: OverviewStats }) {
  const running = stats.liveExperiments > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <Stat
          icon={User}
          tone="blue"
          title="Tracked users this cycle"
          value={formatNumber(stats.trackedUsers)}
          unit="users"
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href={routes.experiments.list}>View usage</Link>
            </Button>
          }
          footnote="Counted against your monthly plan allowance"
        >
          <div className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.max(stats.usageRatio * 100, stats.trackedUsers > 0 ? 2 : 0)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground tabular-nums">
                {(stats.usageRatio * 100).toFixed(0)}% of {formatNumber(stats.trackedUserAllowance)}
              </span>
              <span
                className={cn(
                  "font-medium",
                  stats.usageOnTrack
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {stats.usageOnTrack ? "On track" : "Near limit"}
              </span>
            </div>
          </div>
        </Stat>

        <Stat
          icon={Hourglass}
          tone="amber"
          title={running ? "Experiments running" : "Nothing running yet"}
          value={formatNumber(stats.liveExperiments)}
          unit="live experiments"
          action={
            // The brand's own primary, not a tint of the card's icon colour: this is the same
            // action as the page's header button, and one action should not have two looks.
            <Button size="sm" asChild>
              <Link href={routes.experiments.new()}>New experiment</Link>
            </Button>
          }
          footnote={
            running
              ? "Collecting results while they stay published"
              : "Launch an experiment to start collecting results"
          }
        />

        <Stat
          icon={PenLine}
          tone="green"
          title="Drafts ready to launch"
          value={formatNumber(stats.draftExperiments)}
          unit={stats.draftExperiments === 1 ? "draft" : "drafts"}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`${routes.experiments.list}?status=draft`}>Review drafts</Link>
            </Button>
          }
          footnote="Built but never started collecting traffic"
        />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-semibold tracking-tight">Performance</h2>
            <p className="text-sm text-muted-foreground">All experiments · {stats.year}</p>
          </div>
          <Link
            href={routes.experiments.list}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            View full report
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <Metric
            icon={TrendingUp}
            label="Conversions"
            value={formatNumber(stats.conversions)}
            footnote={experimentCount(stats.measuredExperiments)}
          />
          <Metric
            icon={TrendingUp}
            label="Average uplift"
            value={formatUplift(stats.averageUplift)}
            footnote={experimentCount(stats.upliftExperiments)}
          />
          <Metric
            icon={Users}
            label="Visitors in experiments"
            value={formatNumber(stats.visitorsInExperiments)}
            footnote={experimentCount(stats.measuredExperiments)}
          />
        </div>
      </div>
    </div>
  );
}
