/**
 * Wire contract shared by the tracking SDK (browser) and the ingestion API (server).
 *
 * This module is intentionally **type-only plus frozen constants**: it is imported by both
 * `@routely/sdk` and `@routely/web`, so it must never pull in runtime dependencies and must
 * never grow browser- or server-specific code. Changing anything here is a breaking change
 * for already-installed snippets — bump `SDK_PROTOCOL_VERSION` instead of mutating a shape.
 */

/** Incremented when the config/event payload shape changes incompatibly. */
export const SDK_PROTOCOL_VERSION = 1;

/** Which arm of an experiment a visitor was assigned to. */
export type VariantKey = "CONTROL" | "VARIANT";

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
  variant: "_rt_v",
} as const;

/** A single active experiment as published to the browser. */
export interface ExperimentConfig {
  id: string;
  control: { url: string; match: UrlMatchType };
  variantUrl: string;
  goal: { url: string; match: UrlMatchType };
  /** Percentage of traffic routed to the variant, 0–100. */
  variantSplit: number;
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
  variant: VariantKey;
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
