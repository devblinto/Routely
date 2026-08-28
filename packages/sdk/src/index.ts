/**
 * Routely tracking SDK.
 *
 * A dependency-free browser bundle installed with a single tag:
 *
 *   <script src="https://cdn.example.com/sdk.js" data-site-id="rt_abc123"></script>
 *
 * It is framework-independent because it asks nothing of the host page beyond a `<script>`
 * element — no bundler, no npm package, no lifecycle to hook into. That is what makes the same
 * file work on WordPress, WooCommerce, React, Next.js and hand-written HTML.
 *
 * Three properties govern everything here:
 *
 *  1. **It never breaks the page.** Every failure path — no storage, no network, a malformed
 *     response, a blocked request — ends with the SDK doing nothing. Nothing throws into the
 *     host page, and no promise is left to reject unhandled.
 *  2. **It never blocks the page.** The tag is loaded synchronously so a future redirect can
 *     be decided before paint, but the work itself is asynchronous: reading identity is
 *     microseconds, and the configuration request never gates rendering.
 *  3. **It carries no secret.** The only credential-shaped thing it knows is the public site
 *     id, which is visible in page source by design and permits nothing beyond recording
 *     activity for one website.
 *
 */

import {
  markAssignmentSent,
  readAssignment,
  resolveAssignment,
  resolveAssignmentStores,
} from "./assignment";
import { claimConversion, findGoalMatches } from "./conversion";
import { loadConfig } from "./config";
import { claimPageView } from "./dedupe";
import {
  type EngagementTimer,
  MIN_FLUSH_MS,
  attachEngagement,
  createEngagementTimer,
} from "./engagement";
import { SDK_PROTOCOL_VERSION } from "./contract";
import type { ConfigResponse, VariantKey } from "./contract";
import { type Identity, resolveIdentity } from "./identity";
import { decide, performRedirect } from "./redirect";
import { sendConversion, sendPageEvents, sendTimeOnPage } from "./track";
import { DEFAULT_TIMEOUT_MS } from "./transport";
import { normalizeUrl, readHandoff, stripHandoff } from "./url";

export * from "./contract";
export { resolveIdentity, isValidVisitorId } from "./identity";
export { loadConfig, isConfigResponse } from "./config";
export { resolveAssignment, drawVariant, readAssignment } from "./assignment";
export { decide, findExperimentForUrl } from "./redirect";
export { normalizeUrl, urlMatches, isSameUrl, withHandoff, readHandoff } from "./url";
export { claimPageView } from "./dedupe";
export { createEngagementTimer, attachEngagement } from "./engagement";
export { findGoalMatches, claimConversion } from "./conversion";

export const SDK_VERSION = "0.1.0";

/** Replaced at build time by esbuild's `define`. */
declare const __ROUTELY_API_BASE__: string;

/** Options read from `data-*` attributes on the loading `<script>` tag. */
export interface RoutelyOptions {
  /** Public site id, e.g. `rt_abc123`. Required. Identifies a website, never a person. */
  siteId: string;
  /** API origin. Defaults to the value baked in at build time. */
  apiBase: string;
  /** How long to wait for the configuration request before giving up. */
  timeoutMs: number;
  /** Log what the SDK is doing. Enabled with `data-debug="true"`. */
  debug: boolean;
}

/** What `boot()` resolves to. Exposed on `window.routely` for debugging an installation. */
export interface RoutelyState {
  version: string;
  protocol: number;
  siteId: string;
  visitorId: string;
  identitySource: Identity["source"];
  experiments: ConfigResponse["experiments"];
  /** True when the configuration could not be loaded — the SDK then does nothing. */
  degraded: boolean;
  /** The experiment claiming this page, and the arm the visitor is in. */
  assignment: { experimentId: string; variant: VariantKey } | null;
  /** What the SDK did on this page load. */
  action: "none" | "stay" | "redirect" | "skip";
  /** True when this page load handed events to the browser for delivery. */
  reported: boolean;
  /** The visible-time accumulator, exposed for debugging an installation. */
  engagement?: EngagementTimer;
  /** Experiments whose conversion goal this page load satisfied. */
  conversions: string[];
}

declare global {
  interface Window {
    routely?: RoutelyState;
  }
}

/**
 * Reads options from the `<script>` element that loaded this bundle.
 *
 * Returns `null` when the snippet carries no site id — the signal to do nothing at all. A
 * mis-pasted snippet must never break the page it was pasted into.
 */
export function readOptions(script: HTMLScriptElement | null): RoutelyOptions | null {
  const siteId = script?.dataset.siteId?.trim();
  if (!siteId) return null;

  const timeout = Number(script?.dataset.timeout);

  return {
    siteId,
    apiBase: (script?.dataset.api || __ROUTELY_API_BASE__).replace(/\/+$/, ""),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    debug: script?.dataset.debug === "true",
  };
}

/**
 * Finds the script tag that loaded this bundle.
 *
 * `document.currentScript` is correct and cheap, but it is null when the bundle is loaded
 * asynchronously or injected by a tag manager — both common on the sites this runs on — so
 * there is a fallback that looks for any script carrying a site id.
 */
export function findScript(): HTMLScriptElement | null {
  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.dataset?.siteId) return current;

  return document.querySelector<HTMLScriptElement>("script[data-site-id]");
}

/**
 * Starts the SDK. Resolves to the resulting state, or `null` when there was nothing to do.
 *
 * Deliberately `async` and un-awaited by the bundle's entry call: the host page continues
 * rendering while the configuration request is in flight.
 */
export async function boot(): Promise<RoutelyState | null> {
  const options = readOptions(findScript());
  if (!options) return null;

  const log = options.debug
    ? // eslint-disable-next-line no-console
      (...args: unknown[]) => console.info("[routely]", ...args)
    : () => {};

  // The handoff is read before anything else: it may carry the visitor id from the origin
  // that redirected here, and identity must be resolved with that in hand.
  const href = window.location.href;
  const handoff = readHandoff(href);

  // Identity is resolved synchronously: it depends on nothing external, so it is available
  // even when the network is not.
  const identity = resolveIdentity(undefined, { preferred: handoff?.visitorId });
  log(`visitor ${identity.id} (${identity.isNew ? "new" : "returning"}, ${identity.source})`);

  // Tidied unconditionally, and early: the parameters have served their purpose by now, and
  // leaving them in the address bar means they get bookmarked, shared, and reported to the
  // customer's own analytics as though they were campaign parameters.
  cleanUrl(href);

  const config = await loadConfig(options.apiBase, options.siteId, options.timeoutMs);

  const state: RoutelyState = {
    version: SDK_VERSION,
    protocol: SDK_PROTOCOL_VERSION,
    siteId: options.siteId,
    visitorId: identity.id,
    identitySource: identity.source,
    experiments: config?.experiments ?? [],
    degraded: config === null,
    assignment: null,
    action: "none",
    reported: false,
    conversions: [],
  };

  const publish = () => {
    if (typeof window !== "undefined") window.routely = state;
    return state;
  };

  if (state.degraded) {
    log("configuration unavailable — doing nothing");
    return publish();
  }

  log(`${state.experiments.length} active experiment(s)`);

  const stores = resolveAssignmentStores();

  // Checked before the redirect decision: a redirect ends this page load, and a page that is
  // a conversion goal is never also a control page — the server refuses to create an
  // experiment where those URLs coincide — so the two cannot compete.
  recordConversions(options, state, stores, href, log);

  const decision = decide(
    href,
    state.experiments,
    (experiment) =>
      resolveAssignment(experiment, stores, {
        // A decision carried in from a redirect seeds the assignment on this origin, where
        // storage from the previous one is unavailable. `resolveAssignment` applies it only
        // when nothing is stored, so a query string can never move an existing visitor.
        forced:
          handoff && handoff.experimentId === experiment.id
            ? (handoff.variant as VariantKey)
            : null,
      }).variant,
    { visitorId: identity.id },
  );

  if (!decision) {
    log("no experiment matches this page");
    return publish();
  }

  state.action = decision.action;

  if (decision.action === "skip") {
    log(`skipping ${decision.experiment.id}: ${decision.reason}`);
    // An assignment still exists for a visitor already on the variant; surface it so the state
    // is honest about which arm they are in even when nothing happened this page load.
    const stored = resolveAssignment(decision.experiment, stores, {
      forced:
        handoff?.experimentId === decision.experiment.id ? (handoff.variant as VariantKey) : null,
    });
    state.assignment = { experimentId: decision.experiment.id, variant: stored.variant };
    report(options, state, stores, href);
    trackEngagement(options, state, href);
    return publish();
  }

  state.assignment = { experimentId: decision.experiment.id, variant: decision.variant };

  // Reported before navigating: `sendBeacon` survives the unload, so the events are not lost
  // to the redirect that immediately follows them.
  report(options, state, stores, href);

  if (decision.action === "redirect") {
    log(`redirecting to ${decision.target}`);
    performRedirect(decision.target, decision.experiment.id);
    return publish();
  }

  log(`staying on the control page (${decision.variant})`);
  trackEngagement(options, state, href);
  return publish();
}

/**
 * Measures how long the visitor keeps this page visible.
 *
 * Started only where the visitor actually remains — the control page when they were not
 * redirected, and the variant page they arrived on. A control page that is about to redirect
 * is skipped: the visitor is there for milliseconds, and counting that would drag the
 * control arm's average down for a reason that has nothing to do with the page.
 */
function trackEngagement(options: RoutelyOptions, state: RoutelyState, href: string): void {
  if (!state.assignment || typeof document === "undefined") return;

  const url = normalizeUrl(href) ?? href;
  const { experimentId, variant } = state.assignment;

  const timer = createEngagementTimer({
    visible: document.visibilityState !== "hidden",
  });

  attachEngagement(timer, (durationMs, isFinal) => {
    // Below the threshold a non-final flush is not worth a request; the final one always goes.
    if (!isFinal && durationMs < MIN_FLUSH_MS) return;
    sendTimeOnPage(
      options.apiBase,
      options.siteId,
      state.visitorId,
      {
        experimentId,
        variant,
        url,
      },
      durationMs,
    );
  });

  state.engagement = timer;
}

/**
 * Records a conversion for every experiment whose goal this page satisfies.
 *
 * Only for experiments the visitor is actually assigned to. Reaching the thank-you page
 * without ever having been bucketed is not a conversion *in this experiment* — the visitor
 * arrived by some other route, and counting them would credit the test for traffic it never
 * touched.
 */
function recordConversions(
  options: RoutelyOptions,
  state: RoutelyState,
  stores: ReturnType<typeof resolveAssignmentStores>,
  href: string,
  log: (...args: unknown[]) => void,
): void {
  const matches = findGoalMatches(href, state.experiments);
  if (matches.length === 0) return;

  const url = normalizeUrl(href) ?? href;

  for (const experiment of matches) {
    const assignment = readAssignment(experiment.id, stores);

    if (!assignment) {
      log(`goal matched for ${experiment.id} but this visitor was never assigned`);
      continue;
    }

    // Refreshing the thank-you page, returning to it tomorrow, or a second copy of the SDK on
    // the page all stop here. The database's unique constraint is the real guarantee.
    if (!claimConversion(experiment.id)) {
      log(`conversion already recorded for ${experiment.id}`);
      continue;
    }

    log(`conversion for ${experiment.id} (${assignment.variant})`);
    sendConversion(options.apiBase, options.siteId, state.visitorId, {
      experimentId: experiment.id,
      variant: assignment.variant,
      url,
    });

    state.conversions.push(experiment.id);
    state.reported = true;
  }
}

/**
 * Reports the page view, and the assignment the first time it is made.
 *
 * The URL is normalised before it leaves the browser so the value sent is the one the server
 * will store — the server normalises again regardless, because a URL that arrives over the
 * network is an assertion rather than a fact, but sending the canonical form keeps the two
 * from disagreeing about what page a visitor was on.
 */
function report(
  options: RoutelyOptions,
  state: RoutelyState,
  stores: ReturnType<typeof resolveAssignmentStores>,
  href: string,
): void {
  if (!state.assignment) return;

  const url = normalizeUrl(href) ?? href;
  const { experimentId, variant } = state.assignment;

  const stored = readAssignment(experimentId, stores);
  const includeAssignment = stored ? !stored.sent : true;
  const includePageView = claimPageView(experimentId, url);

  if (!includeAssignment && !includePageView) return;

  const sent = sendPageEvents(
    options.apiBase,
    options.siteId,
    state.visitorId,
    { experimentId, variant, url },
    { includeAssignment, includePageView },
  );

  if (sent) {
    state.reported = true;
    if (includeAssignment) markAssignmentSent(experimentId, stores);
  }
}

/**
 * Removes the handoff parameters from the address bar.
 *
 * Cosmetic but worth doing: they would otherwise be copied into shared links, bookmarked, and
 * sent to the customer's own analytics as though they were campaign parameters.
 * `replaceState` leaves history untouched, so Back still works.
 */
function cleanUrl(href: string): void {
  try {
    const cleaned = stripHandoff(href);
    if (cleaned !== href && typeof history !== "undefined" && history.replaceState) {
      history.replaceState(history.state, "", cleaned);
    }
  } catch {
    // A blocked history API is not worth failing over.
  }
}

if (typeof document !== "undefined") {
  // The rejection handler is the last line of defence. Everything inside `boot` already
  // resolves rather than throwing, so reaching this would be a bug — but a tracking script is
  // exactly the wrong place to find out about one via the customer's error reporting.
  void boot().catch(() => {});
}
