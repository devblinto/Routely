/**
 * Wire contract shared by the tracking SDK (browser) and the ingestion API (server).
 *
 * This module is intentionally **type-only plus frozen constants**: it is imported by both
 * `@routely/sdk` and `@routely/web`, so it must never pull in runtime dependencies and must
 * never grow browser- or server-specific code. Changing anything here is a breaking change
 * for already-installed snippets — bump `SDK_PROTOCOL_VERSION` instead of mutating a shape.
 */

/**
 * Incremented when the config/event payload shape changes incompatibly.
 *
 * v2: `variantUrl`/`variantSplit` (exactly one variant, a stored split) replaced by `variants`
 * (one or more redirect targets) and an implicit equal split derived from their count. The
 * `VariantKey` literal `"CONTROL" | "VARIANT"` became `variantId: string | null` — `null` is
 * control, a variant's id is itself now a meaningful identifier rather than a fixed label.
 *
 * v3: the implicit equal split became explicit per-arm weights — `controlWeight` plus a
 * `weight` on every variant. A v2 bundle reading a v3 config would split evenly and silently
 * ignore a configured distribution, which is exactly the kind of quiet wrongness the version
 * check exists to prevent.
 */
export const SDK_PROTOCOL_VERSION = 3;

/** How a configured URL is compared against the visitor's current URL. */
export type UrlMatchType = "EXACT" | "PREFIX";

/**
 * Kinds of event the SDK reports back to the ingestion endpoint.
 *
 * These strings are also the values of the `EventType` enum in the Prisma schema, so an
 * ingested value is stored verbatim with no translation table between wire and column.
 */
export type EventType = "page_view" | "assignment" | "time_on_page" | "conversion";

/** Query parameters used to hand a visitor's identity across an origin boundary. */
export const HANDOFF_PARAMS = {
  visitorId: "_rt_vid",
  experimentId: "_rt_e",
  /** The variant id the visitor was sent to. Never present for control — control never
   * redirects, so it never needs to hand its arm across an origin boundary. */
  variant: "_rt_v",
} as const;

/** One redirect target within an experiment. */
export interface ExperimentVariantConfig {
  id: string;
  url: string;
  /** This arm's share of the included traffic, relative to `controlWeight` and the other
   * variants' weights. `0` parks the arm — it receives no new visitors. */
  weight: number;
}

/** A single active experiment as published to the browser. */
export interface ExperimentConfig {
  id: string;
  control: { url: string; match: UrlMatchType };
  /** Control's share of the included traffic, relative to each variant's `weight`. */
  controlWeight: number;
  /** One or more redirect targets. */
  variants: ExperimentVariantConfig[];
  goal: { url: string; match: UrlMatchType };
  /**
   * Percentage of visitors on the control page entered into this experiment at all, 1–100.
   * Checked before the arm is drawn: a visitor excluded here is never assigned one. Kept
   * separate from the weights, which only decide *which* arm an included visitor lands on.
   */
  trafficAllocation: number;
}

/** Response of `GET /api/v1/config?siteId=…`. */
export interface ConfigResponse {
  v: typeof SDK_PROTOCOL_VERSION;
  siteId: string;
  experiments: ExperimentConfig[];
  /** Seconds the browser may reuse this document before refetching. */
  ttl: number;
}

/** A single event in an ingestion batch. */
export interface TrackedEvent {
  experimentId: string;
  /** The variant the visitor is in, or `null` for control. */
  variantId: string | null;
  type: EventType;
  url: string;
  /** Accumulated foreground time in milliseconds. Only present on `time_on_page`. */
  durationMs?: number;
  /** Client timestamp in epoch milliseconds; clamped server-side. */
  ts: number;
}

/** Body of `POST /api/v1/events`. */
export interface EventBatch {
  v: typeof SDK_PROTOCOL_VERSION;
  siteId: string;
  visitorId: string;
  events: TrackedEvent[];
}
