"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import type { SiteProtocol } from "@/generated/prisma/enums";
import type { FormState } from "@/lib/form-state";

/**
 * The "Set up Routely" entry point on the Get started page: opens the pixel setup guide in a
 * dialog, so fixing "pixel not detected" doesn't require leaving the page it was noticed on.
 */
export function PixelSetupDialog({
  website,
  sdkUrl,
  verifyAction,
  triggerLabel = "Set up Routely",
  triggerVariant = "default",
  triggerClassName,
  alreadySetUp,
}: {
  website: {
    id: string;
    name: string;
    domain: string;
    protocol: SiteProtocol;
    publicSiteId: string;
  };
  sdkUrl: string;
  verifyAction: (state: FormState, formData: FormData) => Promise<FormState>;
  /** The websites table reuses this dialog per row, where "Re-check pixel" reads better on a
   * site that is already installed than a generic "Set up Routely". */
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  /** Lets a caller size the trigger — the websites table gives every row's buttons equal
   * width so the column lines up regardless of which label each row shows. */
  triggerClassName?: string;
  /** True when this website is already set up, so the guide opens on its final step. */
  alreadySetUp?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  /**
   * Closes the guide and re-reads the page behind it.
   *
   * The verify action revalidates the Get started path, but this dialog lives in a client
   * component that is already mounted — without an explicit refresh the customer would close
   * it and see the status they came here to change, unchanged.
   */
  function finish() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={triggerVariant} className={triggerClassName}>
          <Rocket aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[85vh] max-h-[85vh] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>Set up Routely</DialogTitle>
          <DialogDescription>
            Install the tracking pixel on {website.domain} and verify it&apos;s receiving data.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 px-6 py-6">
          <GetStartedGuide
            website={website}
            sdkUrl={sdkUrl}
            verifyAction={verifyAction}
            startOnDone={alreadySetUp ?? false}
            onDone={finish}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
