import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import {
  ExperimentListHeader,
  ExperimentListRow,
} from "@/components/experiments/experiment-list-row";
import { ListFilters, type StatusTab } from "@/components/experiments/list-filters";
import { RangePicker } from "@/components/experiments/range-picker";
import { Button } from "@/components/ui/button";
import { parseRangeKey, resolveRange } from "@/lib/date-range";
import { routes } from "@/lib/routes";
import { changeExperimentStatusAction } from "@/server/actions/experiment.actions";
import { requireUser } from "@/server/auth/session";
import * as analyticsService from "@/server/services/analytics.service";
import * as experimentService from "@/server/services/experiment.service";
import type { ExperimentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Experiments" };

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
              <div className="overflow-hidden rounded-xl border border-border/70">
                <ExperimentListHeader />
                <div className="divide-y divide-border/70">
                  {experiments.map((experiment) => (
                    <ExperimentListRow
                      key={experiment.id}
                      experiment={experiment}
                      summary={summaries.get(experiment.id)}
                      statusAction={changeExperimentStatusAction}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Conversion rate is the best-performing arm&rsquo;s, over the selected range. Traffic
            share is how much of a site&rsquo;s traffic each experiment is set to include. Open an
            experiment for the per-arm breakdown.
          </p>
        </div>
      )}
    </>
  );
}
