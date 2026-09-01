import { Code2 } from "lucide-react";

import { CodeBlock } from "@/components/common/code-block";
import { CopyValue } from "@/components/websites/copy-value";
import { buildInstallSnippet } from "@/lib/snippet";
import { cn } from "@/lib/utils";

/**
 * The install instructions.
 *
 * One route, deliberately. An earlier version opened on a grid of platforms — WordPress,
 * Shopify, Webflow, Framer and so on — of which exactly one was implemented and the rest read
 * "Coming soon". That grid cost the customer a click and a decision before showing them
 * anything, and its main effect was to advertise eight things the product does not do. The
 * snippet is two script tags; pasting them into `<head>` is the same job on every platform, so
 * there is nothing for a platform picker to actually pick.
 */

function Step({
  n,
  children,
  className,
}: {
  n: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span
        aria-hidden
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}

export function ManualInstall({
  sdkUrl,
  publicSiteId,
  className,
}: {
  sdkUrl: string;
  publicSiteId: string;
  className?: string;
}) {
  const snippet = buildInstallSnippet({ sdkUrl, publicSiteId });

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
        >
          <Code2 className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Manual installation
          </span>
          <h3 className="text-base font-semibold tracking-tight">
            Add the code to your site (5-minute setup)
          </h3>
        </div>
      </div>

      <div className="space-y-5">
        <Step n={1}>
          <p className="text-sm text-muted-foreground">
            Paste this into the{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
              &lt;head&gt;
            </code>{" "}
            tag of every page you want to test — including the goal page.
          </p>
          <CodeBlock code={snippet} label="Copy install snippet" />
          <p className="text-xs text-muted-foreground">
            Keep both blocks, in this order. The first hides the page for up to{" "}
            <code className="font-mono">routelyTimeout</code> milliseconds so a redirected visitor
            never sees the original page first; edit that number, or the{" "}
            <code className="font-mono">#fff</code> background, to suit your site. It lifts on its
            own even if the tracking script never loads.
          </p>
        </Step>

        <Step n={2}>
          <p className="text-sm text-muted-foreground">
            Save your changes, then continue to verify the installation.
          </p>
        </Step>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
        <span className="text-sm font-medium">Your site ID</span>
        <CopyValue value={publicSiteId} label="Copy site id" className="min-w-0 flex-1" />
      </div>
    </div>
  );
}
