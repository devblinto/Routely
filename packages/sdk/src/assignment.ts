import type { ExperimentConfig, VariantKey } from "./contract";
import { type KeyValueStore, createMemoryStore, getLocalStorage } from "./env";

/**
 * Which arm of an experiment a visitor belongs to.
 *
 * The assignment is made **once**, at random, and then persisted. Persistence — not the
 * randomness — is what makes the experience consistent: on every later page load the stored
 * value is read rather than a new draw being made, so a refresh, a return visit or a second
 * tab all see the same version. A visitor who saw the variant yesterday sees it today.
 */

const KEY_PREFIX = "routely_a_";

/** Stored per experiment rather than as one blob, so an experiment can be forgotten alone. */
export function assignmentKey(experimentId: string): string {
  return KEY_PREFIX + experimentId;
}

export interface StoredAssignment {
  variant: VariantKey;
  /** Epoch milliseconds, for diagnostics — never used to expire an assignment. */
  at: number;
  /** True once the backend has acknowledged it, so a failed report can be retried. */
  sent: boolean;
}

function isStoredAssignment(value: unknown): value is StoredAssignment {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredAssignment>;
  return candidate.variant === "CONTROL" || candidate.variant === "VARIANT";
}

/**
 * The stores an assignment is kept in.
 *
 * `localStorage` only: unlike the visitor id, an assignment is not worth a cookie on every
 * request to the customer's own server, and the memory fallback keeps the SDK working for the
 * duration of a page load when storage is denied.
 */
export function resolveAssignmentStores(): KeyValueStore[] {
  const stores: KeyValueStore[] = [];
  const local = getLocalStorage();
  if (local) stores.push(local);
  stores.push(createMemoryStore());
  return stores;
}

export function readAssignment(
  experimentId: string,
  stores: KeyValueStore[],
): StoredAssignment | null {
  for (const store of stores) {
    try {
      const raw = store.getItem(assignmentKey(experimentId));
      if (!raw) continue;

      const parsed: unknown = JSON.parse(raw);
      if (isStoredAssignment(parsed)) return parsed;
    } catch {
      // A corrupted or inaccessible entry is treated as absent, not fatal.
    }
  }
  return null;
}

export function writeAssignment(
  experimentId: string,
  assignment: StoredAssignment,
  stores: KeyValueStore[],
): void {
  const raw = JSON.stringify(assignment);

  for (const store of stores) {
    try {
      store.setItem(assignmentKey(experimentId), raw);
    } catch {
      // A full or read-only store is not a reason to stop trying the others.
    }
  }
}

/**
 * Draws an arm for a visitor who has none.
 *
 * `variantSplit` is the percentage sent to the variant — 50 in the MVP, hence 50/50. The draw
 * is a plain uniform random: with the result persisted, a per-visitor hash would buy nothing
 * except an inability to change the split later without re-bucketing everyone.
 */
export function drawVariant(variantSplit: number, random: () => number = Math.random): VariantKey {
  const split = Number.isFinite(variantSplit) ? Math.min(Math.max(variantSplit, 0), 100) : 50;
  return random() * 100 < split ? "VARIANT" : "CONTROL";
}

export interface AssignmentResult {
  variant: VariantKey;
  /** True when this page load made the decision, rather than reading a stored one. */
  isNew: boolean;
}

/**
 * Returns the visitor's arm for an experiment, drawing and persisting one only if absent.
 *
 * `forced` carries a decision handed over in the URL after a redirect. It is applied only when
 * nothing is stored: a value from a query string is attacker-controllable, so it may seed a
 * new assignment on a fresh origin but must never overwrite one already made.
 */
export function resolveAssignment(
  experiment: Pick<ExperimentConfig, "id" | "variantSplit">,
  stores: KeyValueStore[],
  options: { forced?: VariantKey | null; random?: () => number; now?: number } = {},
): AssignmentResult {
  const existing = readAssignment(experiment.id, stores);
  if (existing) return { variant: existing.variant, isNew: false };

  const variant = options.forced ?? drawVariant(experiment.variantSplit, options.random);

  writeAssignment(experiment.id, { variant, at: options.now ?? Date.now(), sent: false }, stores);

  return { variant, isNew: true };
}

/** Marks an assignment as acknowledged by the backend so it is not reported repeatedly. */
export function markAssignmentSent(experimentId: string, stores: KeyValueStore[]): void {
  const existing = readAssignment(experimentId, stores);
  if (!existing || existing.sent) return;
  writeAssignment(experimentId, { ...existing, sent: true }, stores);
}
