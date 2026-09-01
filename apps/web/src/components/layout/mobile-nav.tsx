"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/server/auth/session";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Drawer replacement for the sidebar below the `lg` breakpoint.
 *
 * It carries the account block too: with the avatar menu gone from the top bar, this is the
 * only place a small-screen user can see who they are signed in as or sign out.
 */
export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle asChild>
            <Brand />
          </SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>

        <SidebarAccount user={user} />
      </SheetContent>
    </Sheet>
  );
}
