import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PixelSetupDialog } from "@/components/get-started/pixel-setup-dialog";
import { PixelStatusBadge } from "@/components/websites/pixel-status-badge";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { routes } from "@/lib/routes";
import { verifyPixelAction } from "@/server/actions/pixel.actions";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

export const metadata: Metadata = { title: "Get started" };

/**
 * The Get started entry point. Scoped to one website — the most recently created one — because
 * it models a single pixel install, and multi-website accounts can revisit a specific website's
 * own install panel from its detail page.
 *
 * The guide itself lives in `PixelSetupDialog`, shared with the dashboard's "Set up Routely"
 * button, so there is exactly one place that renders it rather than a full page copy that could
 * drift from the dialog version.
 */
export default async function GetStartedPage() {
  const user = await requireUser();
  const websites = await websiteService.listWebsites(user.id);
  const website = websites[0];

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
            <Button asChild>
              <Link href={routes.websites.new}>
                <Plus aria-hidden />
                Add website
              </Link>
            </Button>
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
        actions={<PixelStatusBadge detected={pixelDetected} />}
      />

      {pixelDetected ? (
        <p className="text-sm text-muted-foreground">
          {website.name} is receiving tracking data — nothing left to set up.
        </p>
      ) : (
        <PixelSetupDialog website={website} sdkUrl={env.SDK_URL} verifyAction={verifyPixelAction} />
      )}
    </>
  );
}
