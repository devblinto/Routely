import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The card shell every wizard step renders into: title, description, fields, then a footer.
 * Steps that need a custom footer (the summary step's dialog trigger) pass `footer` instead of
 * `onBack`/`onNext`.
 */
export function WizardStepCard({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Replaces the default Back/Continue footer entirely. */
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        {footer ?? (
          <div className="flex items-center justify-between gap-2 pt-2">
            {onBack ? (
              <Button type="button" variant="ghost" onClick={onBack}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {onNext ? (
              <Button type="button" onClick={onNext} disabled={nextDisabled}>
                {nextLabel}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
