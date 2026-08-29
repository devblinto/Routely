import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ExperimentRow } from "@/components/experiments/experiment-row";
import { PageHeader } from "@/components/common/page-header";
import { CopyValue } from "@/components/websites/copy-value";
import { DeleteWebsiteDialog } from "@/components/websites/delete-website-dialog";
import { InstallSnippet } from "@/components/websites/install-snippet";
import { WebsiteForm } from "@/components/websites/website-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { env } from "@/env";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { deleteWebsiteAction, updateWebsiteAction } from "@/server/actions/website.actions";
import { requireUser } from "@/server/auth/session";
import { isAppError } from "@/server/errors";
import * as experimentService from "@/server/services/experiment.service";
import * as websiteService from "@/server/services/website.service";

export const metadata: Metadata = { title: "Website" };

/**
 * Website detail.
 *
 * Ordered by what the reader needs when: identity at the top, then installation (the only
 * thing standing between a new website and useful data), then experiments, then the settings
 * they will rarely touch. Editing and deleting share one card so the page does not read as
 * five equally-weighted panels.
 */
export default async function WebsitePage({ params }: { params: Promise<{ websiteId: string }> }) {
  const user = await requireUser();
  const { websiteId } = await params;

  // The service scopes by actor, so an id belonging to someone else raises NOT_FOUND — the
  // same response as an id that does not exist, which is what keeps ids unprobeable.
  const website = await websiteService.getWebsite(user.id, websiteId).catch((error) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });

  const experiments = await experimentService.listExperiments(user.id, website.id);
  const activeCount = experiments.filter((experiment) => experiment.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href={routes.experiments.list}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Experiments
          </Link>
        }
        title={website.name}
        description={website.domain}
        actions={
          <Button asChild>
            <Link href={routes.experiments.new(website.id)}>
              <Plus aria-hidden />
              New experiment
            </Link>
          </Button>
        }
      />

      {/* Identity strip: the three facts worth seeing without scrolling. */}
      <Card size="sm">
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_1fr_1fr]">
            <div className="min-w-0 space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">Public site id</dt>
              <dd>
                <CopyValue value={website.publicSiteId} label="Copy public site id" />
              </dd>
            </div>

            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">Created</dt>
              <dd className="text-sm">
                <time dateTime={website.createdAt.toISOString()}>
                  {formatDate(website.createdAt)}
                </time>
              </dd>
            </div>

            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">Experiments</dt>
              <dd className="flex items-center gap-2 text-sm">
                {experiments.length}
                {activeCount > 0 ? <Badge variant="secondary">{activeCount} active</Badge> : null}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <InstallSnippet
        sdkUrl={env.SDK_URL}
        publicSiteId={website.publicSiteId}
        domain={website.domain}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Experiments</h2>
          {experiments.length > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={routes.experiments.new(website.id)}>
                <Plus aria-hidden />
                New experiment
              </Link>
            </Button>
          ) : null}
        </div>

        {experiments.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No experiments yet"
            description="Create an experiment to send half your visitors to an alternative page and compare the two."
            action={
              <Button asChild>
                <Link href={routes.experiments.new(website.id)}>
                  <Plus aria-hidden />
                  New experiment
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {experiments.map((experiment) => (
              <li key={experiment.id}>
                <ExperimentRow experiment={experiment} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Settings</h2>

        <Card>
          <CardHeader>
            <CardTitle>Website details</CardTitle>
            <CardDescription>
              Renaming a website or correcting its domain does not change the public site id, so
              your installed snippet keeps working.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-xl">
              <WebsiteForm
                action={updateWebsiteAction}
                websiteId={website.id}
                defaultName={website.name}
                defaultDomain={website.domain}
                submitLabel="Save changes"
                pendingLabel="Saving…"
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Delete this website</p>
                <p className="text-sm text-pretty text-muted-foreground">
                  Removes the website and every experiment, visitor and conversion recorded under
                  it. This cannot be undone.
                </p>
              </div>
              <DeleteWebsiteDialog
                action={deleteWebsiteAction}
                websiteId={website.id}
                websiteName={website.name}
                experimentCount={experiments.length}
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
