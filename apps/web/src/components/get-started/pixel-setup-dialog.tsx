"use client";

import { Rocket } from "lucide-react";

import { GetStartedGuide } from "@/components/get-started/get-started-guide";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "@/lib/form-state";

/**
 * The "Set up Routely" entry point on the dashboard: opens the same setup guide as the
 * `/get-started` page, in a dialog, so fixing "pixel not detected" doesn't require leaving
 * the page it was noticed on.
 */
export function PixelSetupDialog({
  website,
  sdkUrl,
  verifyAction,
}: {
  website: { id: string; name: string; domain: string; publicSiteId: string };
  sdkUrl: string;
  verifyAction: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Rocket aria-hidden />
          Set up Routely
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up Routely</DialogTitle>
          <DialogDescription>
            Install the tracking pixel on {website.domain} and verify it&apos;s receiving data.
          </DialogDescription>
        </DialogHeader>

        <GetStartedGuide
          website={website}
          sdkUrl={sdkUrl}
          verifyAction={verifyAction}
          initialPixelDetected={false}
        />
      </DialogContent>
    </Dialog>
  );
}
