import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PILL_CLASSES =
  "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold [&>svg]:size-4!";

/**
 * Whether tracking data has arrived for this website.
 *
 * Deliberately not phrased as "pixel detected": no data is the normal state for a correctly
 * installed snippet on a website with no running experiment, and saying the pixel is missing
 * would contradict the install check that just passed.
 *
 * Pass `href` to make it a link — used as a shortcut back to the Get started guide.
 */
export function PixelStatusBadge({
  receivingData,
  href,
}: {
  receivingData: boolean;
  href?: string;
}) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        PILL_CLASSES,
        receivingData
          ? "border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-300",
      )}
    >
      {receivingData ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
      {receivingData ? "Receiving data" : "No data yet"}
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
