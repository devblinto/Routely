"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Digest of the underlying error, shown so a user can quote it in a bug report. */
  digest?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Rendered by `error.tsx` boundaries. It deliberately never surfaces the raw error message,
 * which may contain internals; `digest` is the safe identifier Next.js exposes for
 * correlating a user report with a server log line.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this page. Try again, and if it keeps happening let us know.",
  digest,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">{description}</p>
      {digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {digest}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
