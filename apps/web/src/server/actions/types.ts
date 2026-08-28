import "server-only";

import type { FormState } from "@/lib/form-state";
import { toPublicError } from "@/server/errors";

export type { FormState } from "@/lib/form-state";

/**
 * Runs a service call and converts a thrown `AppError` into form state.
 *
 * Framework control-flow errors — `redirect()` and `notFound()` — must reach Next.js
 * untouched, so callers perform their redirect *after* this resolves rather than inside it.
 */
export async function runAction<T>(
  operation: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; state: FormState }> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const { message } = toPublicError(error);
    const fieldErrors =
      error instanceof Object && "fieldErrors" in error
        ? (error.fieldErrors as Record<string, string[]> | undefined)
        : undefined;

    return {
      ok: false,
      state: { status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) },
    };
  }
}
