"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sign-out control for the sidebar footer.
 *
 * Rendered as the enclosing form's submit button, so signing out is a plain form submission to
 * a Server Action — no client-side session library, and it still works if JavaScript fails to
 * load. `useFormStatus` needs to be inside the form, which is why this is its own component
 * rather than markup in the footer.
 *
 * Styled to match `SidebarNav`'s links deliberately: it sits directly beneath them and reads
 * as the last item in that list, so anything else would look like a stray control.
 */
export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={collapsed ? "Sign out" : undefined}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
        "text-muted-foreground transition-[background-color,color] duration-300 ease-in-out",
        "outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4 shrink-0" aria-hidden />
      )}
      {/* Always rendered so the collapse animates as a width/opacity fade rather than a snap —
       * the same treatment the nav links above use. */}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
          collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
        )}
      >
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
