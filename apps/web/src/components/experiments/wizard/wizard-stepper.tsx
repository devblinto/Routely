"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The wizard's step indicator, rendered as a section at the top of the wizard page.
 *
 * It used to sit in the app's 56px top bar, sharing that strip with the menu button and the
 * wordmark, which is why labels were withheld until `xl`. In the page it has the full content
 * width to itself, so they appear from `sm` — at which point the strip is orientation rather
 * than decoration. Below that only the current step keeps its label, which is the one piece of
 * orientation that still matters when space runs out.
 */

export interface StepperItem {
  key: string;
  label: string;
}

export function WizardStepper({
  steps,
  currentIndex,
  maxIndex,
  onSelect,
  className,
}: {
  steps: StepperItem[];
  currentIndex: number;
  /** Furthest step reached, which is as far as the customer may jump back and forth. */
  maxIndex: number;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Experiment setup" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 overflow-x-auto">
        {steps.map((item, index) => {
          const completed = index < maxIndex;
          const current = index === currentIndex;
          const reachable = index <= maxIndex;

          return (
            <li key={item.key} className="flex shrink-0 items-center gap-1">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-px w-4 shrink-0",
                    index <= maxIndex ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}

              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(item.key)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full py-1 pr-1 pl-1 transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                  current ? "bg-muted pr-2.5" : "hover:bg-muted/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-1",
                    completed
                      ? "bg-primary text-primary-foreground ring-primary"
                      : current
                        ? "bg-background text-foreground ring-foreground/60"
                        : "bg-background text-muted-foreground ring-border",
                  )}
                >
                  {completed ? <Check className="size-3.5" /> : index + 1}
                </span>

                <span
                  aria-hidden
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    // The current step keeps its label at every width; the rest appear once
                    // there is room, so the strip degrades to plain circles rather than wrapping.
                    current ? "inline text-foreground" : "hidden text-muted-foreground sm:inline",
                  )}
                >
                  {item.label}
                </span>

                {/* The visible label above is decorative — this is the one that gets announced,
                 * so a step reads the same whether or not its label fits on screen. */}
                <span className="sr-only">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
