/**
 * Result shape shared by Server Actions and the forms that call them.
 *
 * This module deliberately has **no imports**: it is referenced from both client components
 * (through `useActionState`) and server code, so anything server-only reachable from here
 * would be dragged into the browser bundle — which is exactly what `server-only` exists to
 * prevent. Keep it plain data.
 *
 * React serialises `FormState` across the network boundary, so it holds no `Error` objects
 * (they would arrive as `{}`). Field errors are keyed by input `name` so a form can render
 * them beside the offending field without knowing anything about Zod.
 */
export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const IDLE: FormState = { status: "idle" };
