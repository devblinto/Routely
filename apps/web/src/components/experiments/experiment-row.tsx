import Link from "next/link";

import { ExperimentStatusBadge } from "@/components/experiments/status-badge";
import { PublishPauseButton } from "@/components/experiments/publish-pause-button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { changeExperimentStatusAction } from "@/server/actions/experiment.actions";
import type { Experiment } from "@/generated/prisma/client";

/**
 * One experiment in a website's list.
 *
 * The publish/pause control sits outside the row's link rather than inside it — a button
 * nested in an anchor is invalid HTML, and clicking it would follow the link as well as
 * submitting. Splitting them keeps one tab stop for "open" and one for "publish/pause".
 */
export function ExperimentRow({ experiment }: { experiment: Experiment }) {
  return (
    <Card size="sm" className="transition focus-within:ring-ring">
      <div className="flex items-center gap-3 px-(--card-spacing)">
        <Link
          href={routes.experiments.detail(experiment.id)}
          className="min-w-0 flex-1 rounded-md outline-none"
        >
          <span className="block truncate text-sm font-medium">{experiment.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {experiment.controlUrl}
          </span>
        </Link>

        <span className="hidden text-xs whitespace-nowrap text-muted-foreground md:block">
          {experiment.publishedAt
            ? `Published ${formatDate(experiment.publishedAt)}`
            : `Created ${formatDate(experiment.createdAt)}`}
        </span>

        <ExperimentStatusBadge status={experiment.status} />

        <PublishPauseButton
          action={changeExperimentStatusAction}
          experimentId={experiment.id}
          status={experiment.status}
        />
      </div>
    </Card>
  );
}
