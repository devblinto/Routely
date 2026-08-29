import { ChartLine, CircleCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * The parts of the configuration step that are not built yet.
 *
 * Each needs machinery Routely does not have: auto-allocating to a winner is a bandit
 * algorithm, scheduling needs a start/end window the config endpoint honours, the stop
 * conditions need a rule that can end a running experiment, and the load-timing options need
 * the SDK to observe SPA navigation and DOM changes rather than just page load.
 *
 * **Statistical significance is listed but stays disabled deliberately**, independent of the
 * others: Routely does not compute significance anywhere, and the results page says so in as
 * many words. Shipping it as a stop condition would make the product act on a claim it
 * explicitly declines to make.
 */

function ToggleRow({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon?: typeof Users;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      {Icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant="secondary" className="shrink-0">
        Coming soon
      </Badge>
    </div>
  );
}

function Section({
  title,
  optional = false,
  description,
  children,
}: {
  title: string;
  optional?: boolean;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-border/70 pt-5 opacity-60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {title}
            {optional ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Optional)</span>
            ) : null}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children ? null : (
          <Badge variant="secondary" className="shrink-0">
            Coming soon
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

export function ConfigurationExtras() {
  return (
    <div className="space-y-5">
      <Section
        title="Automatically send more traffic to winners"
        description="Everyone starts on the split above. As results come in, more new visitors go to the version that's ahead."
      />

      <Section
        title="Schedule Campaign"
        optional
        description="Leave blank to start immediately, or run the test without an end date."
      />

      <Section
        title="Stop Conditions"
        optional
        description="Define limits to automatically finish the experiment."
      >
        <div className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
          <ToggleRow
            icon={Users}
            title="Visitor Limit"
            description="End after a specific number of visitors"
          />
          <ToggleRow
            icon={CircleCheck}
            title="Conversion Limit"
            description="End after a specific number of conversions"
          />
          <ToggleRow
            icon={ChartLine}
            title="Statistical Significance"
            description="End when results are statistically significant — Routely does not test for significance, by design"
          />
        </div>
      </Section>

      <Section
        title="When to load test"
        description="Routely applies the redirect on page load. Waiting for a condition, or triggering it yourself in code, needs SPA-aware tracking that isn't built yet."
      />
    </div>
  );
}
