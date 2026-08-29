import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled form field with optional help text and server-side error messages.
 *
 * Wiring the ids here — `aria-describedby` pointing at both the hint and the error, and
 * `aria-invalid` set from the presence of errors — means every form gets the same accessible
 * behaviour without each one remembering to do it.
 */
export function Field({
  name,
  label,
  hint,
  errors,
  children,
  className,
  id: idOverride,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  errors?: string[];
  /** Receives the props the input must spread to be described by the label and messages. */
  children: (props: {
    id: string;
    name: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
  className?: string;
  /** Overrides the derived `field-${name}` id — needed when the same `name` repeats, as with a
   * dynamic list of same-named inputs (e.g. several "variantUrl" rows). */
  id?: string;
}) {
  const id = idOverride ?? `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>

      {children({
        id,
        name,
        "aria-describedby": describedBy,
        "aria-invalid": errors?.length ? true : undefined,
      })}

      {errors?.length ? (
        <p id={errorId} className="text-xs text-destructive">
          {errors.join(" ")}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
