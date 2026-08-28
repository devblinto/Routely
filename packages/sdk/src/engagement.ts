/**
 * Approximate visible time on page.
 *
 * ## This is an approximation, and cannot be anything else
 *
 * A browser will not tell a script how long a person looked at a page. What it exposes is
 * whether the *document* is visible, which is a much weaker signal:
 *
 *  - A visible tab on a monitor the person has walked away from counts as engaged time.
 *  - A tab visible behind another window counts as visible on most browsers.
 *  - A phone locking the screen, or the browser being backgrounded, is reported reliably —
 *    but a person simply looking away is not reported at all.
 *  - Time after the final flush is lost: a crash, a force-quit, or a browser that drops the
 *    last beacon all end the measurement silently.
 *  - Deltas are measured against the device clock, which can jump.
 *
 * So this measures *document visibility*, and calls it engaged time because that is the
 * closest honest approximation available in a browser. It is useful for comparing two arms of
 * one experiment — both are measured the same way, so the bias is shared and largely cancels —
 * and it is not a session-duration metric. Any number derived from it should be read as
 * "roughly, and comparatively", never as fact.
 *
 * ## Why deltas rather than one total
 *
 * Time is reported incrementally: each flush sends only what has accumulated since the last
 * one. The alternative — accumulate everything and send once at the end — loses the whole
 * measurement whenever the final event does not fire. Reporting as the visitor goes means a
 * dropped last beacon costs the tail, not the total, and the sum of the deltas is still the
 * total visible time.
 */

export interface EngagementTimer {
  /** Visible milliseconds accumulated since the last flush. */
  unsent(): number;
  /** Total visible milliseconds for this page load, flushed or not. */
  total(): number;
  /** Called when the document becomes visible. */
  resume(): void;
  /** Called when the document becomes hidden. Accrues the interval just ended. */
  pause(): void;
  /** Returns the unsent milliseconds and marks them as reported. */
  take(): number;
  /** True once `finalize()` has run; every later call is a no-op. */
  isFinalized(): boolean;
  /** Final accrual. Returns whatever is left to report; safe to call more than once. */
  finalize(): number;
}

export interface EngagementOptions {
  /** Injected for tests, and so a monotonic source can be preferred over the wall clock. */
  now?: () => number;
  /** Whether the document is visible at construction. */
  visible?: boolean;
}

/**
 * `performance.now()` is monotonic: it does not jump when the device clock is corrected, NTP
 * steps it, or the user changes time zone. `Date.now()` does all three, and a jump would show
 * up as a visitor who read one page for eleven hours.
 */
function defaultNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** Ceiling on a single visible interval: six hours. Anything longer is a stuck tab, not a read. */
const MAX_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function createEngagementTimer(options: EngagementOptions = {}): EngagementTimer {
  const now = options.now ?? defaultNow;

  let accumulated = 0;
  let reported = 0;
  let visibleSince: number | null = options.visible === false ? null : now();
  let finalized = false;

  /** Folds the interval in progress into the accumulator and restarts it if still visible. */
  function accrue(keepRunning: boolean): void {
    if (visibleSince !== null) {
      const elapsed = now() - visibleSince;
      // Negative is impossible with a monotonic clock but cheap to guard; the ceiling catches
      // a machine that slept with the tab open.
      if (elapsed > 0) accumulated += Math.min(elapsed, MAX_INTERVAL_MS);
    }
    visibleSince = keepRunning ? now() : null;
  }

  return {
    unsent() {
      const live = visibleSince === null ? 0 : Math.min(now() - visibleSince, MAX_INTERVAL_MS);
      return Math.max(0, Math.round(accumulated + live - reported));
    },

    total() {
      const live = visibleSince === null ? 0 : Math.min(now() - visibleSince, MAX_INTERVAL_MS);
      return Math.round(accumulated + live);
    },

    resume() {
      if (finalized || visibleSince !== null) return;
      visibleSince = now();
    },

    pause() {
      if (finalized) return;
      accrue(false);
    },

    take() {
      if (finalized) return 0;
      accrue(visibleSince !== null);
      const pending = Math.max(0, Math.round(accumulated - reported));
      reported += pending;
      return pending;
    },

    isFinalized() {
      return finalized;
    },

    finalize() {
      // Idempotent by design: `pagehide` and `visibilitychange` can both fire during the same
      // teardown, and a second final event would double-count the tail.
      if (finalized) return 0;
      accrue(false);
      const pending = Math.max(0, Math.round(accumulated - reported));
      reported += pending;
      finalized = true;
      return pending;
    },
  };
}

/**
 * Below this, a flush is not worth a network request.
 *
 * Flicking between tabs produces a stream of tiny intervals; batching them until they are
 * worth reporting keeps a distracted visitor from generating a request per switch. The final
 * flush ignores this threshold, so nothing measurable is dropped at the end.
 */
export const MIN_FLUSH_MS = 1000;

export interface EngagementBinding {
  /** Removes every listener. Returns whatever remained unreported. */
  detach(): number;
}

/**
 * Wires an engagement timer to the document's lifecycle.
 *
 * Kept separate from the timer so the arithmetic can be tested without a DOM, and so the
 * choice of events is visible in one place:
 *
 *  - **`visibilitychange`** is the signal the spec is built on — it fires when a tab is
 *    switched away from, when a window is minimised, and when a phone is locked or the browser
 *    backgrounded. Pausing here is what makes this *visible* time rather than elapsed time.
 *  - **`pagehide`** is the reliable end-of-page event. Unlike `beforeunload` it fires on mobile
 *    Safari and does not disqualify the page from the back/forward cache.
 *  - **`beforeunload` is deliberately not used.** Registering it prevents bfcache in several
 *    browsers, which would make navigation slower for the customer's visitors — a real cost
 *    paid for a marginal gain in an already-approximate metric.
 */
export function attachEngagement(
  timer: EngagementTimer,
  flush: (durationMs: number, isFinal: boolean) => void,
  target: Document | undefined = typeof document === "undefined" ? undefined : document,
): EngagementBinding {
  if (!target) {
    return { detach: () => 0 };
  }

  const onVisibilityChange = () => {
    if (target.visibilityState === "hidden") {
      timer.pause();
      const pending = timer.take();
      // A hidden page may never come back — this is the last certain chance to report.
      if (pending > 0) flush(pending, false);
    } else {
      timer.resume();
    }
  };

  const onPageHide = () => {
    const pending = timer.finalize();
    if (pending > 0) flush(pending, true);
    detach();
  };

  function detach(): number {
    target!.removeEventListener("visibilitychange", onVisibilityChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onPageHide);
    }
    return timer.unsent();
  }

  target.addEventListener("visibilitychange", onVisibilityChange);
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onPageHide);
  }

  return { detach };
}
