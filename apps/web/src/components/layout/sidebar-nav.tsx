"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isNavItemActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * Primary navigation. Shared between the desktop sidebar and the mobile drawer; `onNavigate`
 * lets the drawer close itself after a link is followed. `collapsed` drops the label down to a
 * `title` attribute — used only by the desktop sidebar, never the drawer.
 *
 * The icon stays left-aligned in both states rather than re-centering when collapsed:
 * `justify-content` can't be interpolated by a CSS transition (it snaps partway through), so
 * animating it alongside the sidebar's width made the icon visibly jump mid-collapse.
 */
export function SidebarNav({
  onNavigate,
  collapsed = false,
  className,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={cn("flex flex-col gap-1", className)}>
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
              "transition-[background-color,color] duration-300 ease-in-out",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {/* Always rendered so the collapse animates as a width/opacity fade instead of a snap. */}
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
