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
 * Platform picker for the install step. WordPress is the only tile that responds to a click —
 * it starts unselected, so nothing is nominally chosen until the customer picks it, at which
 * point the guide below reveals its instructions. Every other tile is a disabled preview of
 * what's coming, never selectable.
 */
export function PlatformGrid({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {PLATFORMS.map((platform) => {
        const Icon = platform.icon;

        if (!platform.available) {
          return (
            <div
              key={platform.name}
              aria-disabled="true"
              className="flex cursor-not-allowed flex-col items-center gap-2 rounded-lg border border-border/70 p-4 text-center text-muted-foreground opacity-60"
            >
              <Icon className="size-6" aria-hidden />
              <span className="text-sm font-medium text-foreground">{platform.name}</span>
              <Badge variant="secondary">Coming soon</Badge>
            </div>
          );
        }

        return (
          <button
            key={platform.name}
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border/70 hover:border-primary/50 hover:bg-muted/40",
            )}
          >
            <Icon className="size-6" aria-hidden />
            <span className="text-sm font-medium text-foreground">{platform.name}</span>
            {selected ? <Badge>Selected</Badge> : <Badge variant="outline">Available</Badge>}
          </button>
        );
      })}
    </div>
  );
}
