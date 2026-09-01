"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host, mounted once in the root layout.
 *
 * Styled from the app's own theme tokens rather than sonner's defaults, so a toast is
 * recognisably part of the product in either colour scheme and does not need a second palette
 * kept in sync with the first.
 *
 * `richColors` is deliberately off. It paints success green and error red across the whole
 * surface, which reads as an alarm for what is usually a routine confirmation; the icon and
 * the wording carry the meaning instead, and the destructive token is reserved for the errors
 * that genuinely warrant it.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      // Applies to successes and errors alike. Kept here as the single place the timing is
      // set, so changing it does not mean hunting for a second value elsewhere.
      duration={3000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          closeButton: "border-border bg-popover text-muted-foreground",
          error: "border-destructive/30 [&_[data-icon]]:text-destructive",
          success: "[&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:text-emerald-400",
        },
      }}
      {...props}
    />
  );
}
