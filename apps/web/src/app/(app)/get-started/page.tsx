import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AddWebsiteDialog } from "@/components/websites/add-website-dialog";
import { WebsitesTable } from "@/components/websites/websites-table";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { routes } from "@/lib/routes";
import { verifyPixelAction } from "@/server/actions/pixel.actions";
import { deleteWebsitesAction } from "@/server/actions/website.actions";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

export const metadata: Metadata = { title: "Get started" };

/**
 * The Get started entry point: every website the account owns, with its install state.
 *
 * Previously this scoped the whole page to one website chosen through `?websiteId=`, which
 * answered "how do I set up this site" but not "which of my sites still need setting up" —
 * the question someone with several websites actually opens this page to ask. The table shows
 * all of them at once, and each row carries its own setup dialog, so nothing has to be
 * selected first and the query param is no longer needed.
 */
export default async function GetStartedPage() {
  const user = await requireUser();
  const entries = await websiteService.listWebsitesWithStatus(user.id);

  if (entries.length === 0) {
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

  return (
    <>
      <PageHeader
        title="Get started"
        description="Install the Routely snippet on each website, then run experiments on it."
        actions={
          <Button asChild>
            <Link href={routes.experiments.new()}>
              <Plus aria-hidden />
              New experiment
            </Link>
          </Button>
        }
      />

      <WebsitesTable
        entries={entries}
        sdkUrl={env.SDK_URL}
        verifyAction={verifyPixelAction}
        deleteAction={deleteWebsitesAction}
      />
    </>
  );
}
