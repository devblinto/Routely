import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Call to action that resolves the empty state, e.g. "Add website". */
  action?: ReactNode;
  className?: string;
}

/**
 * Shown when a collection is legitimately empty — a first-run state, not a failure. Pair it
 * with an action so the screen always tells the user what to do next.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </div>
      ) : null}
      <h2 className="text-base font-medium">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
