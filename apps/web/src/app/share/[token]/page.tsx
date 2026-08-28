import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExperimentResults } from "@/components/experiments/results";
import { ExperimentStatusBadge } from "@/components/experiments/status-badge";
import { Brand } from "@/components/layout/brand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import * as analyticsService from "@/server/services/analytics.service";
import * as experimentService from "@/server/services/experiment.service";

/**
 * Public, read-only results.
 *
 * Reached by an unguessable token and nothing else — no session, and no way to navigate from
 * here to anything the viewer was not given. What it shows is deliberately narrow: this
 * experiment's numbers and its configured URLs. It does not name the account, list other
 * experiments, or link into the dashboard.
 *
 * Outside the `(app)` route group on purpose, so it inherits neither the authenticated layout
 * nor the proxy's protected prefixes.
 */

/** Never indexed: a share link is private-by-obscurity, and a crawler would defeat that. */
export const metadata: Metadata = {
  title: "Experiment results",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const experiment = await experimentService.findSharedExperiment(token);

  // An unknown token and a revoked one are the same 404. Distinguishing them would tell a
  // stranger that a link once existed, which is not theirs to learn.
  if (!experiment) {
    notFound();
  }

  // No actor: the token authorised this read, so the stats are fetched directly rather than
  // through the owner-scoped path.
  const stats = await analyticsService.getSharedExperimentStats(experiment.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href={routes.home} />
          <Badge variant="outline">Shared results</Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{experiment.name}</h1>
            <ExperimentStatusBadge status={experiment.status} />
          </div>
          {experiment.description ? (
            <p className="text-sm text-pretty text-muted-foreground">{experiment.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {experiment.publishedAt
              ? `Running since ${formatDate(experiment.publishedAt)}`
              : "Not yet published"}
            {" · All time"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What is being tested</CardTitle>
            <CardDescription>
              Visitors arriving at the control are split evenly. Reaching the conversion URL counts
              as a conversion for whichever version they saw.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Control", url: experiment.controlUrl },
              { label: "Variant", url: experiment.variantUrl },
              { label: "Conversion goal", url: experiment.conversionUrl },
            ].map(({ label, url }) => (
              <div key={label} className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="truncate font-mono text-sm" title={url}>
                  {url}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ExperimentResults
          stats={stats}
          controlUrl={experiment.controlUrl}
          variantUrl={experiment.variantUrl}
          variantSplit={experiment.variantSplit}
          isDraft={experiment.status === "DRAFT"}
        />

        <p className="border-t border-border/70 pt-6 text-xs text-muted-foreground">
          Shared from Routely. Whoever created this link can revoke it at any time.
        </p>
      </main>
    </div>
  );
}
