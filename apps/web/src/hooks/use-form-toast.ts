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
 * Errors are given a longer life than successes and are dismissed by the user. A success
 * confirms something they just did and can be missed harmlessly; a failure usually asks them
 * to do something differently, and removing that on a timer means reproducing the error to
 * read it again.
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
      if (text) toast.error(text, { duration: Infinity });
    }
  }, [state, options.success, options.error]);
}
