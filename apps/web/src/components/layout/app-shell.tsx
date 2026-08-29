"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useNavbarSlot } from "@/components/layout/navbar-slot";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/server/auth/session";

/**
 * Dashboard chrome: a fixed sidebar on large screens, a drawer below that, and a fixed top bar
 * carrying the account menu. Pages render into `children` and control their own spacing only
 * through the shared container width; only `<main>` scrolls.
 *
 * The sidebar collapses to an icon rail — state lives here, not in `localStorage`, since the
 * `(app)` layout keeps this component mounted across navigations within the group.
 */
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const navbarContent = useNavbarSlot();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <MobileNav />
          <div className="lg:hidden">
            <Brand />
          </div>
          {/* Whatever the current page has published — see `navbar-slot.tsx`. Empty on most
           * pages, which leaves this as the spacer that pushes the account menu right. */}
          <div className="min-w-0 flex-1">{navbarContent}</div>
          <UserMenu user={user} />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
