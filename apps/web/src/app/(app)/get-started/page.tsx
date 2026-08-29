import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PixelSetupDialog } from "@/components/get-started/pixel-setup-dialog";
import { AddWebsiteDialog } from "@/components/websites/add-website-dialog";
import { PixelStatusBadge } from "@/components/websites/pixel-status-badge";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { verifyPixelAction } from "@/server/actions/pixel.actions";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

export const metadata: Metadata = { title: "Get started" };

/**
 * The Get started entry point.
 *
 * Scoped to one website at a time, because the guide models a single pixel install — but which
 * one is chosen through `?websiteId=`, not fixed to the newest. Defaulting silently to the most
 * recent was actively confusing with several websites: the verify step rejects any URL outside
 * the selected website's domain, so the page would insist on a domain the customer had not
 * chosen and offered no way to change.
 *
 * A search param rather than client state keeps this a server component and makes a particular
 * website's guide linkable, matching how `/experiments/new` scopes itself.
 *
 * The guide itself lives in `PixelSetupDialog`, so there is exactly one place that renders it
 * rather than a full page copy that could drift from the dialog version.
 */
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ websiteId?: string }>;
}) {
  const user = await requireUser();
  const [{ websiteId }, websites] = await Promise.all([
    searchParams,
    websiteService.listWebsites(user.id),
  ]);

  // Only the actor's own websites are listed, so an id from the query string can never select
  // somebody else's — an unknown one simply falls back to the first.
  const website = websites.find((candidate) => candidate.id === websiteId) ?? websites[0];

  if (!website) {
    return (
      <>
        <PageHeader
          title="Get started"
          description="Add a website to get a tracking snippet, then install it to start running experiments."
        />
        <EmptyState
          icon={Globe}
          title="No websites yet"
          description="Create a website first — the setup guide installs its tracking pixel."
          action={
            <AddWebsiteDialog
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Add website
                </Button>
              }
            />
          }
        />
      </>
    );
  }

  const pixelDetected = await websiteService.isPixelDetected(user.id, website.id);

  return (
    <>
      <PageHeader
        title="Get started"
        description={`Install the Routely pixel on ${website.domain} and verify it's receiving data.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <PixelStatusBadge detected={pixelDetected} />
            <Button asChild>
              <Link href={routes.experiments.new(website.id)}>
                <Plus aria-hidden />
                New experiment
              </Link>
            </Button>
          </div>
        }
      />

      {websites.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Setting up:</span>
          {websites.map((candidate) => {
            const selected = candidate.id === website.id;

            return (
              <Link
                key={candidate.id}
                href={`${routes.getStarted}?websiteId=${encodeURIComponent(candidate.id)}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary/5 font-medium text-foreground"
                    : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {candidate.name}
                <span className="ml-1.5 font-mono text-xs opacity-70">{candidate.domain}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {pixelDetected ? (
        <p className="text-sm text-muted-foreground">
          {website.name} is receiving tracking data — nothing left to set up.
        </p>
      ) : null}

      <PixelSetupDialog website={website} sdkUrl={env.SDK_URL} verifyAction={verifyPixelAction} />
    </>
  );
}
