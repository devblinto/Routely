import {
  Blocks,
  Bot,
  Building2,
  Code2,
  Frame,
  Globe,
  Layers,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Platform {
  name: string;
  icon: LucideIcon;
  /** Only WordPress is wired up today; every other tile is a preview of what's coming. */
  available: boolean;
}

const PLATFORMS: Platform[] = [
  { name: "WordPress", icon: Globe, available: true },
  { name: "AI Agent (MCP)", icon: Bot, available: false },
  { name: "Shopify", icon: ShoppingBag, available: false },
  { name: "Next.js", icon: Code2, available: false },
  { name: "Webflow", icon: Layers, available: false },
  { name: "Framer", icon: Frame, available: false },
  { name: "Wix", icon: Blocks, available: false },
  { name: "BigCommerce", icon: Store, available: false },
  { name: "Hubspot", icon: Building2, available: false },
];

/**
 * Platform picker for the install step. Every tile beyond WordPress is disabled and labelled
 * "Coming soon" — shown so the guide reads like a roadmap, not hidden, but not clickable.
 */
export function PlatformGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PLATFORMS.map((platform) => {
        const Icon = platform.icon;

        return (
          <div
            key={platform.name}
            aria-current={platform.available ? "true" : undefined}
            aria-disabled={!platform.available}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 text-center",
              platform.available
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border/70 text-muted-foreground opacity-60",
            )}
          >
            <Icon className="size-6" aria-hidden />
            <span className="text-sm font-medium text-foreground">{platform.name}</span>
            {platform.available ? (
              <Badge>Selected</Badge>
            ) : (
              <Badge variant="secondary">Coming soon</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
