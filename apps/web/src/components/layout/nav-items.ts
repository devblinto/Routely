import { FlaskConical, Globe, LayoutDashboard, type LucideIcon } from "lucide-react";

import { routes } from "@/lib/routes";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true the item is active only on an exact path match, not on descendants. */
  exact?: boolean;
}

/** Shared by the desktop sidebar and the mobile drawer so the two can never disagree. */
export const NAV_ITEMS: NavItem[] = [
  { href: routes.dashboard, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: routes.websites.new, label: "Add website", icon: Globe },
  { href: "/experiments", label: "Experiments", icon: FlaskConical, exact: true },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
