import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Compact product proof shown beneath the sign-in card.
 *
 * A centred layout leaves no room for a marketing panel, so this is the one-line version:
 * two page URLs, their conversion rates, and which one won. It says what Routely does to
 * someone who has landed here cold, in the space of a caption.
 *
 * Built from styled elements rather than an image so it stays crisp, follows the theme
 * tokens, and costs no network request. It is decorative — `aria-hidden` keeps it out of the
 * accessibility tree, and the sentence below it carries the same meaning as text.
 */

function Arm({ url, rate, winner = false }: { url: string; rate: string; winner?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <span
        className={cn(
          "max-w-full truncate rounded-md px-2 py-1 font-mono text-[11px]",
          winner ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {url}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          winner ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {rate}
      </span>
    </div>
  );
}

export function ExperimentPreview({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div
        aria-hidden
        className="flex items-center justify-center gap-4 rounded-xl bg-card/60 px-4 py-3 ring-1 ring-border/70"
      >
        <Arm url="/pricing" rate="4.1%" />
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60" />
        <Arm url="/pricing-v2" rate="7.3%" winner />
      </div>
      <p className="text-center text-xs text-balance text-muted-foreground">
        Split traffic between two URLs and see which one converts.
      </p>
    </div>
  );
}
