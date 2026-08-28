import "server-only";

import { z } from "zod";

import { validationFailed } from "@/server/errors";

/**
 * The single bridge between Zod and the application's error taxonomy.
 *
 * Services call this instead of `safeParse` so every rejected input produces the same shape:
 * an `AppError("VALIDATION")` carrying field-level messages a form can render directly. Doing
 * it in one place also means no service can accidentally use unvalidated input, because the
 * only value it ever sees is the parsed one.
 */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  input: unknown,
  message = "Check the values you entered.",
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const { fieldErrors, formErrors } = z.flattenError(result.error);
    throw validationFailed(message, {
      ...(fieldErrors as Record<string, string[]>),
      ...(formErrors.length > 0 ? { _form: formErrors } : {}),
    });
  }

  return result.data;
}
