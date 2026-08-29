import Link from "next/link";
import { Split } from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The product wordmark.
 *
 * `size="lg"` is the standalone treatment used on unauthenticated screens, where the mark is
 * the only branding on the page; `sm` is the inline treatment for the dashboard chrome.
 */
export function Brand({
  className,
  href = routes.experiments.list,
  size = "sm",
  showLabel = true,
}: {
  className?: string;
  href?: string;
  size?: "sm" | "lg";
  /** Hidden by the collapsed sidebar, which only has room for the mark. */
  showLabel?: boolean;
}) {
  const large = size === "lg";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-md font-semibold tracking-tight",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        large ? "gap-2.5 text-base" : "gap-2 text-sm",
        className,
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground",
          large ? "size-10 shadow-sm" : "size-7 rounded-md",
        )}
      >
        <Split className={large ? "size-5" : "size-4"} aria-hidden />
      </span>
      {/* Always rendered so the collapse animates as a width/opacity fade instead of a snap. */}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
          showLabel ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0",
        )}
      >
        Routely
      </span>
    </Link>
  );
}
