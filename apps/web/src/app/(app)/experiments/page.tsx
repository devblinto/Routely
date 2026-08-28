import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ExperimentStatusBadge } from "@/components/experiments/status-badge";
import { LiftBadge } from "@/components/experiments/lift-badge";
import { ListFilters, type StatusTab } from "@/components/experiments/list-filters";
import { RangePicker } from "@/components/experiments/range-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseRangeKey, resolveRange } from "@/lib/date-range";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import * as analyticsService from "@/server/services/analytics.service";
import * as experimentService from "@/server/services/experiment.service";
import type { ExperimentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Experiments" };

/** Below this many assigned visitors, a lift figure is noise — see components/results.tsx. */
const MIN_VISITORS_FOR_LIFT = 30;

const STATUS_TABS: { key: string; label: string; status?: ExperimentStatus }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Running", status: "ACTIVE" },
  { key: "draft", label: "Draft", status: "DRAFT" },
  { key: "paused", label: "Paused", status: "PAUSED" },
  { key: "archived", label: "Archived", status: "ARCHIVED" },
];

/**
 * Every experiment the user owns, across all their websites.
 *
 * Filtering and search happen in the database, and the per-row metrics come from one batched
 * aggregation rather than a query per row — so the page costs the same whether a customer has
 * three experiments or three hundred.
 */
export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; range?: string }>;
}) {
  const user = await requireUser();
  const { status = "all", q = "", range } = await searchParams;

  const rangeKey = parseRangeKey(range);
  const selected = STATUS_TABS.find((tab) => tab.key === status) ?? STATUS_TABS[0]!;

  const [experiments, counts] = await Promise.all([
    experimentService.listAllExperiments(user.id, {
      ...(selected.status ? { status: selected.status } : {}),
      ...(q.trim() ? { search: q.trim() } : {}),
    }),
    experimentService.countByStatus(user.id),
  ]);

  const summaries = await analyticsService.getExperimentSummaries(
    user.id,
    experiments.map((experiment) => experiment.id),
    resolveRange(rangeKey),
  );

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const tabs: StatusTab[] = STATUS_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    count: tab.status ? counts[tab.status] : total,
  }));

  const isFiltered = status !== "all" || q.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Experiments"
        description="Every redirect test across your websites."
        actions={
          <div className="flex items-center gap-2">
            <RangePicker value={rangeKey} />
            <Button asChild>
              <Link href={routes.experiments.new()}>
                <Plus aria-hidden />
                New experiment
              </Link>
            </Button>
          </div>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Create an experiment to send half your visitors to an alternative page and compare the two."
          action={
            <Button asChild>
              <Link href={routes.experiments.new()}>
                <Plus aria-hidden />
                New experiment
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <ListFilters tabs={tabs} status={status} search={q} />

          {experiments.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Nothing matches those filters"
              description={
                isFiltered
                  ? "Try a different status, or clear the search."
                  : "No experiments to show."
              }
            />
          ) : (
            <>
              {/* A table on wide screens, stacked cards below — the same data either way, since
                  a horizontally-scrolling table is a poor way to read numbers on a phone. */}
              <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium">
                      <th>Experiment</th>
                      <th>Status</th>
                      <th className="text-right!">Visitors</th>
                      <th className="text-right!">Converted</th>
                      <th className="text-right!">Control</th>
                      <th className="text-right!">Variant</th>
                      <th className="text-right!">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {experiments.map((experiment) => {
                      const summary = summaries.get(experiment.id);
                      const enough = (summary?.assignedVisitors ?? 0) >= MIN_VISITORS_FOR_LIFT * 2;

                      return (
                        <tr key={experiment.id} className="transition-colors hover:bg-muted/40">
                          <td className="max-w-0 px-4 py-3">
                            <Link
                              href={routes.experiments.detail(experiment.id)}
                              className="block truncate font-medium hover:underline"
                            >
                              {experiment.name}
                            </Link>
                            <span className="block truncate text-xs text-muted-foreground">
                              {experiment.website.domain} · {formatDate(experiment.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ExperimentStatusBadge status={experiment.status} />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatNumber(summary?.assignedVisitors ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatNumber(summary?.conversions ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                            {formatPercent(summary?.controlRate ?? null)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatPercent(summary?.variantRate ?? null)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <LiftBadge lift={summary?.lift ?? null} meaningful={enough} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {experiments.map((experiment) => {
                  const summary = summaries.get(experiment.id);
                  const enough = (summary?.assignedVisitors ?? 0) >= MIN_VISITORS_FOR_LIFT * 2;

                  return (
                    <li key={experiment.id}>
                      <Card size="sm">
                        <Link
                          href={routes.experiments.detail(experiment.id)}
                          className="block space-y-2 px-(--card-spacing) outline-none"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{experiment.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {experiment.website.domain}
                              </span>
                            </span>
                            <ExperimentStatusBadge status={experiment.status} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{formatNumber(summary?.assignedVisitors ?? 0)} visitors</span>
                            <span>{formatNumber(summary?.conversions ?? 0)} converted</span>
                            <span>
                              {formatPercent(summary?.controlRate ?? null)} →{" "}
                              {formatPercent(summary?.variantRate ?? null)}
                            </span>
                            <LiftBadge lift={summary?.lift ?? null} meaningful={enough} />
                          </div>
                        </Link>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Change is the variant&rsquo;s conversion rate relative to the control&rsquo;s. It is
            descriptive arithmetic, not a significance test, and is hidden until an experiment has
            enough traffic for the comparison to mean anything.
          </p>
        </div>
      )}
    </>
  );
}
