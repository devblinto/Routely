import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PILL_CLASSES =
  "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold [&>svg]:size-4!";

/**
 * Whether this website's tracking pixel has fired.
 *
 * Rendered plain on the Get started guide, where the customer is already looking at how to
 * fix it. Pass `href` to make it a link instead — used elsewhere as a shortcut back to that
 * guide.
 */
export function PixelStatusBadge({ detected, href }: { detected: boolean; href?: string }) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        PILL_CLASSES,
        detected
          ? "border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-300",
      )}
    >
      {detected ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
      {detected ? "Pixel detected" : "Pixel not detected"}
    </Badge>
  );

  if (!href) {
    return badge;
  }

  return (
    <Link
      href={href}
      className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {badge}
    </Link>
  );
}
