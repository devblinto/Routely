"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { FormState } from "@/lib/form-state";

/**
 * Announces a Server Action's outcome as a toast.
 *
 * Every action in this app already returns `FormState`, so this needs no per-form wiring
 * beyond one call — the shape that made field errors renderable is the same shape that makes
 * outcomes announceable.
 *
 * **Field errors are deliberately not toasted.** A message about one input belongs beside that
 * input, where the user is looking and where it stays while they fix it; a toast would move it
 * away from the field and then take it away on a timer. Only `state.message` — the outcome of
 * the action as a whole — is surfaced here.
 *
 * Successes and errors share one duration, set on the Toaster. Either can be dismissed early
 * with the close button.
 *
 * The trade this accepts: a failure the user looks away from is gone when they look back, and
 * re-reading it means triggering it again. Where a message is genuinely instructional rather
 * than informational — the pixel verify step's "check it's in the <head>, and that any caching
 * plugin has been cleared" is the likely candidate — it belongs on the page next to the
 * control that produced it, not in a toast at all.
 */
export function useFormToast(
  state: FormState,
  options: { success?: string; error?: string } = {},
): void {
  // Identity, not value: `useActionState` returns a new object per submission, so two
  // consecutive identical failures are two distinct states and both should be announced.
  // Comparing messages would silently swallow the second.
  const seen = useRef(state);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;

    if (state.status === "success") {
      const text = options.success ?? state.message;
      if (text) toast.success(text);
      return;
    }

    if (state.status === "error") {
      // A failure carrying only field errors is already rendered beside the fields; a toast
      // would repeat it somewhere less useful.
      const text = options.error ?? state.message;
      if (text) toast.error(text);
    }
  }, [state, options.success, options.error]);
}
