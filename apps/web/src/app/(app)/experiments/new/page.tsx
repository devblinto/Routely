import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Globe, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ExperimentForm } from "@/components/experiments/experiment-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import { createExperimentAction } from "@/server/actions/experiment.actions";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

export const metadata: Metadata = { title: "New experiment" };

export default async function NewExperimentPage({
  searchParams,
}: {
  searchParams: Promise<{ websiteId?: string }>;
}) {
  const user = await requireUser();
  const [{ websiteId }, websites] = await Promise.all([
    searchParams,
    websiteService.listWebsites(user.id),
  ]);

  // Only the actor's own websites are offered, and the action re-checks ownership anyway —
  // a websiteId typed into the query string cannot select somebody else's website.
  const preselected = websites.find((website) => website.id === websiteId);
  const backHref = preselected ? routes.websites.detail(preselected.id) : routes.dashboard;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={backHref} className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden />
            {preselected ? preselected.name : "Websites"}
          </Link>
        }
        title="New experiment"
        description="Send half your visitors to an alternative page and compare which one converts better."
      />

      {websites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Add a website first"
          description="An experiment belongs to a website, which is what supplies the tracking snippet and the domain its URLs must be on."
          action={
            <Button asChild>
              <Link href={routes.websites.new}>
                <Plus aria-hidden />
                Add website
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Experiment setup</CardTitle>
            <CardDescription>
              {preselected ? (
                <>
                  All three URLs must be on{" "}
                  <span className="font-medium">{preselected.domain}</span> or one of its
                  subdomains. The experiment is saved as a draft — nothing is redirected until you
                  activate it.
                </>
              ) : (
                <>
                  The experiment is saved as a draft — nothing is redirected until you activate it.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExperimentForm
              action={createExperimentAction}
              websites={websites.map(({ id, name, domain }) => ({ id, name, domain }))}
              selectedWebsiteId={preselected?.id}
              submitLabel="Create draft"
              pendingLabel="Creating…"
              cancelHref={backHref}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
