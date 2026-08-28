import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Plus } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { WebsiteCard } from "@/components/websites/website-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

export const metadata: Metadata = { title: "Dashboard" };

/** The website list. Scoped to the signed-in user by the service, never by the query string. */
export default async function DashboardPage() {
  const user = await requireUser();
  const websites = await websiteService.listWebsitesWithCounts(user.id);

  return (
    <>
      <PageHeader
        title="Websites"
        description="Add a website, install the tracking snippet once, then run redirect experiments on it."
        actions={
          websites.length > 0 ? (
            <Button asChild>
              <Link href={routes.websites.new}>
                <Plus aria-hidden />
                Add website
              </Link>
            </Button>
          ) : null
        }
      />

      {websites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No websites yet"
          description="Create your first website to get a tracking snippet and start comparing pages."
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
        <ul className="space-y-3">
          {websites.map((website) => (
            <li key={website.id}>
              <WebsiteCard
                website={website}
                experimentCount={website._count.experiments}
                activeCount={website.activeExperiments}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
