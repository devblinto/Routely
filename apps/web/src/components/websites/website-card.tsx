import Link from "next/link";
import { ChevronRight, FlaskConical, Globe } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";

/**
 * One website in the dashboard list.
 *
 * The whole card is a single link rather than a card containing links: it gives one large,
 * unambiguous target, and keeps the keyboard tab order to one stop per website.
 */
export function WebsiteCard({
  website,
  experimentCount,
  activeCount,
}: {
  website: { id: string; name: string; domain: string; createdAt: Date };
  experimentCount: number;
  /** How many of those experiments are currently running. */
  activeCount: number;
}) {
  return (
    <Card className="transition focus-within:ring-ring hover:ring-foreground/20">
      <Link
        href={routes.websites.detail(website.id)}
        className="flex items-center gap-4 px-(--card-spacing) outline-none"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Globe className="size-4" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{website.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{website.domain}</span>
        </span>

        <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="size-3.5" aria-hidden />
            {experimentCount} experiment{experimentCount === 1 ? "" : "s"}
          </span>
          {activeCount > 0 ? <Badge>{activeCount} running</Badge> : null}
        </span>

        <span className="hidden text-xs text-muted-foreground md:block">
          Added {formatDate(website.createdAt)}
        </span>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </Card>
  );
}
