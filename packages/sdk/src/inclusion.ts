import { type KeyValueStore } from "./env";

/**
 * Whether a visitor participates in an experiment at all.
 *
 * A gate that runs *before* the arm is drawn: `trafficAllocation` decides who is entered into
 * the experiment at all, `drawArm` (in `assignment.ts`) then decides which arm for whoever was.
 * Kept as a separate persisted decision — mirroring `assignment.ts` — so a visitor excluded on
 * their first visit stays excluded on their second, rather than being re-rolled every page load.
 */

const KEY_PREFIX = "routely_i_";

export function inclusionKey(experimentId: string): string {
  return KEY_PREFIX + experimentId;
}

export interface StoredInclusion {
  included: boolean;
  /** Epoch milliseconds, for diagnostics only. */
  at: number;
}

function isStoredInclusion(value: unknown): value is StoredInclusion {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Partial<StoredInclusion>).included === "boolean";
}

export function readInclusion(
  experimentId: string,
  stores: KeyValueStore[],
): StoredInclusion | null {
  for (const store of stores) {
    try {
      const raw = store.getItem(inclusionKey(experimentId));
      if (!raw) continue;

      const parsed: unknown = JSON.parse(raw);
      if (isStoredInclusion(parsed)) return parsed;
    } catch {
      // A corrupted or inaccessible entry is treated as absent, not fatal.
    }
  }
  return null;
}

export function writeInclusion(
  experimentId: string,
  inclusion: StoredInclusion,
  stores: KeyValueStore[],
): void {
  const raw = JSON.stringify(inclusion);

  for (const store of stores) {
    try {
      store.setItem(inclusionKey(experimentId), raw);
    } catch {
      // A full or read-only store is not a reason to stop trying the others.
    }
  }
}

export interface InclusionResult {
  included: boolean;
  /** True when this page load made the decision, rather than reading a stored one. */
  isNew: boolean;
}

/**
 * Decides whether a visitor is entered into an experiment, drawing and persisting the decision
 * only if absent. A visitor found not included here is never assigned an arm and nothing about
 * them is reported for this experiment — they see the control page, unaltered, indefinitely.
 */
export function resolveInclusion(
  experimentId: string,
  trafficAllocation: number,
  stores: KeyValueStore[],
  options: { random?: () => number; now?: number } = {},
): InclusionResult {
  const existing = readInclusion(experimentId, stores);
  if (existing) return { included: existing.included, isNew: false };

  const pct = Number.isFinite(trafficAllocation)
    ? Math.min(Math.max(trafficAllocation, 0), 100)
    : 100;
  const random = options.random ?? Math.random;
  const included = random() * 100 < pct;

  writeInclusion(experimentId, { included, at: options.now ?? Date.now() }, stores);

  return { included, isNew: true };
}
