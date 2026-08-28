import { Badge } from "@/components/ui/badge";

type Status = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

/** Wording and emphasis for each lifecycle state, so status reads the same everywhere. */
const PRESENTATION: Record<
  Status,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "outline" },
  ACTIVE: { label: "Running", variant: "default" },
  PAUSED: { label: "Paused", variant: "secondary" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

export function ExperimentStatusBadge({ status }: { status: Status }) {
  const { label, variant } = PRESENTATION[status];
  return <Badge variant={variant}>{label}</Badge>;
}
