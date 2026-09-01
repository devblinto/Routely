"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/server/auth/session";

/**
 * Dashboard chrome: a fixed sidebar on large screens, a drawer below that. Pages render into
 * `children` and control their own spacing only through the shared container width; only
 * `<main>` scrolls.
 *
 * There is **no top bar on desktop**. Once account identity moved to the foot of the sidebar
 * and the experiment wizard's stepper moved into its own page, the bar had nothing left in it
 * — a 56px empty strip above every page. What remains is a slim bar below `lg`, which is not a
 * leftover: at that width there is no sidebar, so the drawer's menu button and the wordmark
 * have nowhere else to live.
 *
 * The sidebar collapses to an icon rail — state lives here, not in `localStorage`, since the
 * `(app)` layout keeps this component mounted across navigations within the group.
 */
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // `fixed inset-0` rather than a height: the shell manages its own scrolling in `<main>`, so
  // it must not also contribute height to the document. Taking it out of flow leaves `<body>`
  // with nothing to scroll, which is the only way to guarantee a second scrollbar cannot appear
  // — a height-based shell is always one rounding difference (a horizontal scrollbar, browser
  // chrome, an injected element) away from overflowing by a few pixels.
  //
  // Scoped to the dashboard: the public share page and the auth screens scroll the document
  // normally and never mount this component.
  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <aside
        className={cn(
          "relative hidden shrink-0 flex-col border-r border-border bg-sidebar lg:flex",
          "transition-[width] duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        {/*
         * Padding is constant across both states (matching `SidebarNav`'s own `px-3`) rather
         * than toggled — animating it moved the icon horizontally, which is what read as the
         * logo "shaking" during the collapse.
         */}
        <div className="flex h-14 shrink-0 items-center overflow-hidden px-3">
          <Brand showLabel={!collapsed} />
        </div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-2">
          <SidebarNav collapsed={collapsed} />
        </div>

        <SidebarAccount user={user} collapsed={collapsed} />

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute top-16 -right-3 z-10 grid size-6 cursor-pointer place-items-center rounded-full",
            "border border-border bg-background text-muted-foreground shadow-sm",
            "transition-[color,background-color,box-shadow,transform] duration-150 ease-in-out",
            "outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90",
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" aria-hidden />
          ) : (
            <ChevronLeft className="size-3.5" aria-hidden />
          )}
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Below `lg` only: the sidebar is a drawer there, and its trigger has to live
         * somewhere. On `lg` and up this is not rendered at all. */}
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6 lg:hidden">
          <MobileNav user={user} />
          <Brand />
        </header>

        {/*
         * Content fills the width the sidebar leaves it. There was a `max-w-6xl` centring
         * wrapper here, which on a wide monitor left a band of empty page down both sides of
         * tables that had columns to spare — a reading-width cap is right for prose and wrong
         * for a data table. Line length is still capped where it matters: `PageHeader` holds
         * its description to `max-w-2xl`.
         *
         * The padding stays. It is margin, not a cap, and content flush to the viewport edge
         * reads as a layout bug rather than as more room.
         */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
