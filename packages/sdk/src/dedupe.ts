import { type KeyValueStore, getSessionStorage } from "./env";

/**
 * Guard against reporting the same page view more than once.
 *
 * The SDK can genuinely run twice on one page load — two copies of the snippet pasted by
 * different people, a tag manager injecting it alongside a hard-coded tag, a framework that
 * re-executes scripts on hydration. Each copy would otherwise report its own page view, and
 * the arm whose page happens to carry the duplicate tag would be inflated for a reason that
 * has nothing to do with the change being tested.
 *
 * Two layers, because neither alone is enough:
 *
 *  - **A module-level flag** catches the same bundle instance running twice. Free, but useless
 *    when the page loads two separate copies of the script, each with its own module scope.
 *  - **A `sessionStorage` marker** keyed by experiment and URL catches that case, since the
 *    two copies share the browser's storage even though they share no variables.
 *
 * The server applies its own five-second window regardless, because the client is exactly the
 * thing that cannot be trusted to have run once.
 */

const KEY_PREFIX = "routely_pv_";

/** Set once per bundle instance, per page load. */
let reportedInThisInstance = false;

/**
 * How long a marker suppresses a repeat.
 *
 * Long enough to cover a burst from double-initialisation, short enough that a person
 * genuinely reloading the page a few seconds later is still counted.
 */
const WINDOW_MS = 5_000;

export function pageViewKey(experimentId: string, url: string): string {
  return KEY_PREFIX + experimentId + "|" + url;
}

/**
 * Returns true the first time it is called for a page, false for any repeat within the window.
 * Marks the page as reported as a side effect, so callers cannot forget to.
 */
export function claimPageView(
  experimentId: string,
  url: string,
  store: KeyValueStore | null = getSessionStorage(),
  now: number = Date.now(),
): boolean {
  if (reportedInThisInstance) return false;

  const key = pageViewKey(experimentId, url);

  if (store) {
    try {
      const previous = Number(store.getItem(key));
      if (Number.isFinite(previous) && previous > 0 && now - previous < WINDOW_MS) {
        // Another copy of the SDK on this same page load already reported it.
        reportedInThisInstance = true;
        return false;
      }
      store.setItem(key, String(now));
    } catch {
      // Without storage the module flag still prevents the common case.
    }
  }

  reportedInThisInstance = true;
  return true;
}

/** Test seam: forget that a page view was reported. */
export function resetPageViewGuard(): void {
  reportedInThisInstance = false;
}
