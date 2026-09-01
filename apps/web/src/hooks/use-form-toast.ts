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
 * Errors are given a longer life than successes, but both clear on their own. A success
 * confirms something the user just did and can be missed harmlessly; a failure usually asks
 * them to do something differently and is often a sentence or two, so it gets roughly double
 * the time to read before it goes. Either can be dismissed early with the close button.
 *
 * The trade this accepts: a failure the user looks away from is gone when they look back, and
 * re-reading it means triggering it again. Where a message is genuinely instructional rather
 * than informational, prefer keeping it on the page next to the control that produced it.
 */

/**
 * How long a failure stays on screen.
 *
 * Longer than the 4s the Toaster gives a success, because an error message is usually a
 * sentence explaining what to do rather than three words confirming what happened, and a
 * notice that leaves before it can be read is the same as no notice at all.
 */
const ERROR_DURATION_MS = 8000;
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
      if (text) toast.error(text, { duration: ERROR_DURATION_MS });
    }
  }, [state, options.success, options.error]);
}
