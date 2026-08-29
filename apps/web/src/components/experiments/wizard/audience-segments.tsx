import {
  DollarSign,
  Monitor,
  Repeat,
  Search,
  Share2,
  Smartphone,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Who an experiment is shown to.
 *
 * Only "All visitors" is wired up. Every preset below it needs a signal Routely does not
 * collect yet — device type and referrer are never sent by the SDK, and "new vs returning"
 * needs a visitor's history read at decision time, before the config request even resolves.
 * They are listed rather than hidden so the roadmap is visible, and disabled rather than
 * silently inert so nobody configures a segment that would quietly match everyone.
 *
 * This mirrors the platform grid on the Get started guide, where WordPress is the one live
 * option and the rest are previews of what is coming.
 */

interface Segment {
  name: string;
  description: string;
  icon: LucideIcon;
  /** What Routely would have to start collecting before this can ship. */
  needs: string;
}

const PRESET_SEGMENTS: Segment[] = [
  {
    name: "Mobile & Tablet Traffic",
    description: "Visitors on mobile or tablet devices.",
    icon: Smartphone,
    needs: "device type",
  },
  {
    name: "Desktop Traffic",
    description: "Visitors on desktop devices.",
    icon: Monitor,
    needs: "device type",
  },
  {
    name: "New Visitors",
    description: "First-time visitors to your website.",
    icon: UserPlus,
    needs: "visitor history",
  },
  {
    name: "Returning Visitors",
    description: "Visitors who have been here before.",
    icon: Repeat,
    needs: "visitor history",
  },
  {
    name: "Paid Campaign Traffic",
    description: "Arrived via Google/Meta ads or paid UTM campaigns.",
    icon: DollarSign,
    needs: "campaign parameters",
  },
  {
    name: "Organic Search Traffic",
    description: "Arrived via Google, Bing or other search engines.",
    icon: Search,
    needs: "referrer",
  },
  {
    name: "Social Traffic",
    description: "Arrived via Facebook, Instagram, LinkedIn, etc.",
    icon: Share2,
    needs: "referrer",
  },
];

export function AudienceSegments() {
  return (
    <div className="space-y-4">
      {/* The one live option, given its own weight above the list rather than sitting as the
       * first row of eight — it is the choice every experiment currently uses. */}
      <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 p-4 ring-1 ring-primary">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Users className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">All Visitors</p>
          <p className="text-sm text-muted-foreground">All the visitors reaching your website.</p>
        </div>
        <Badge>Selected</Badge>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Preset segments
        </p>

        <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
          {PRESET_SEGMENTS.map((segment) => {
            const Icon = segment.icon;

            // Not a button: there is nothing to click yet. The "Coming soon" badge is real
            // text, so the state reaches a screen reader without an `aria-disabled` that the
            // implicit `listitem` role would not support anyway.
            return (
              <li
                key={segment.name}
                className="flex cursor-not-allowed items-center gap-3 p-3 opacity-60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{segment.name}</p>
                  <p className="text-sm text-muted-foreground">{segment.description}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Coming soon
                </Badge>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          Targeting a preset needs a signal Routely doesn&rsquo;t collect yet — device type,
          referrer or visitor history — so every experiment currently runs against all visitors.
        </p>
      </div>
    </div>
  );
}
