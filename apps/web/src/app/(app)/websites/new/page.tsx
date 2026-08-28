import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { WebsiteForm } from "@/components/websites/website-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { createWebsiteAction } from "@/server/actions/website.actions";

export const metadata: Metadata = { title: "Add website" };

export default async function NewWebsitePage() {
  await requireUser();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href={routes.dashboard}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Websites
          </Link>
        }
        title="Add a website"
        description="A website groups your experiments and gives you one tracking snippet to install."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Website details</CardTitle>
          <CardDescription>You can change both of these later.</CardDescription>
        </CardHeader>
        <CardContent>
          <WebsiteForm
            action={createWebsiteAction}
            submitLabel="Create website"
            pendingLabel="Creating…"
            cancelHref={routes.dashboard}
          />
        </CardContent>
      </Card>
    </>
  );
}
