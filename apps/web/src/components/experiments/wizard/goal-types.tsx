import {
  ArrowDown,
  Asterisk,
  CheckCircle2,
  Code,
  DollarSign,
  ExternalLink,
  Eye,
  MousePointer2,
  Pencil,
  Send,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * How a conversion is defined.
 *
 * Only **Pageview** is wired up: a conversion is a visitor reaching the goal URL, which is the
 * one signal the SDK already reports. Everything else needs a capability that does not exist
 * yet — DOM listeners for the click and form goals, an intersection observer for element
 * visibility, a public `routely.track()` call for custom events, and an order value for
 * revenue. None of those are a matter of reading a different field off an existing event.
 *
 * Listed rather than hidden so the roadmap is visible, and disabled rather than silently inert
 * so nobody configures a goal that would never fire. Same pattern as the platform grid on the
 * Get started guide and the audience segments on the previous step.
 */

interface GoalType {
  name: string;
  description: string;
  icon: LucideIcon;
}

const GOAL_GROUPS: { label: string; types: GoalType[] }[] = [
  {
    label: "Key metrics",
    types: [
      {
        name: "Pageview (Wildcard)",
        description: "Match URLs using a * wildcard pattern",
        icon: Asterisk,
      },
      { name: "Custom Event", description: "Track custom events via JavaScript", icon: Zap },
      { name: "Revenue", description: "Track purchases and order value", icon: DollarSign },
    ],
  },
  {
    label: "User actions",
    types: [
      { name: "Click Link", description: "Track clicks on outbound links", icon: ExternalLink },
      { name: "Form Submit", description: "Track form submissions", icon: Send },
      { name: "Click Text", description: "Track clicks on specific text", icon: Pencil },
      { name: "Click Element", description: "Track clicks using a CSS selector", icon: MousePointer2 },
      {
        name: "Element Appears",
        description: "Track when an element appears on the page",
        icon: Eye,
      },
    ],
  },
  {
    label: "Advanced",
    types: [
      {
        name: "Pageview (Exact)",
        description: "Exact URL match including query params",
        icon: Target,
      },
      { name: "Pageview (Regex)", description: "Match URLs using a regex pattern", icon: Code },
      {
        name: "Scroll Depth",
        description: "Track when users scroll to a percentage",
        icon: ArrowDown,
      },
    ],
  },
];

function GoalCard({
  type,
  selected = false,
}: {
  type: GoalType;
  selected?: boolean;
}) {
  const Icon = type.icon;

  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-lg border p-4",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "cursor-not-allowed border-border/70 opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md",
          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="pr-5 text-sm font-medium">{type.name}</p>
        <p className="text-sm text-muted-foreground">{type.description}</p>
        {selected ? null : (
          <Badge variant="secondary" className="mt-1">
            Coming soon
          </Badge>
        )}
      </div>

      {selected ? (
        <CheckCircle2 className="absolute top-3 right-3 size-4 text-primary" aria-hidden />
      ) : null}
    </div>
  );
}

export function GoalTypes() {
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium">How do you define this conversion goal?</p>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Key metrics
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* The one live goal type, so it leads its group rather than being buried in it. */}
          <GoalCard
            selected
            type={{
              name: "Pageview",
              description: "Track when users visit a specific URL",
              icon: Eye,
            }}
          />
          {GOAL_GROUPS[0]!.types.map((type) => (
            <GoalCard key={type.name} type={type} />
          ))}
        </div>
      </div>

      {GOAL_GROUPS.slice(1).map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.types.map((type) => (
              <GoalCard key={type.name} type={type} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
