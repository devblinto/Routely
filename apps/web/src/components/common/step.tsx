import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One numbered step in a guided sequence.
 *
 * The connecting rule is drawn by the step itself rather than by the container, so steps can
 * be added or reordered without the caller maintaining "is this the last one" logic — the
 * final step simply passes `last`.
 */
export function Step({
  number,
  title,
  description,
  children,
  last = false,
}: {
  number: number;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4">
      {!last ? (
        <span aria-hidden className="absolute top-8 bottom-0 left-[0.9375rem] w-px bg-border" />
      ) : null}

      <span
        aria-hidden
        className="relative grid size-8 shrink-0 place-items-center rounded-full bg-background text-xs font-semibold text-foreground ring-1 ring-border"
      >
        {number}
      </span>

      <div className={cn("min-w-0 flex-1 space-y-3", last ? "pb-0" : "pb-8")}>
        <div className="space-y-1">
          <h4 className="text-sm leading-8 font-medium">{title}</h4>
          {description ? (
            <p className="text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}
