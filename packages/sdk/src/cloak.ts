/**
 * Anti-flicker cloak.
 *
 * A redirect test has an unavoidable race. The tag is synchronous, so the SDK runs before the
 * page paints — but the *decision* needs the experiment configuration, and that is a network
 * request. While it is in flight the browser carries on parsing and paints the control page.
 * When the answer arrives the redirect fires, and the visitor has seen the wrong page for as
 * long as the request took. That flash is the "flicker".
 *
 * The fix every A/B tool uses is the same: hide the page until the decision is made, then
 * reveal it. Doing that safely is the whole of this module, because a cloak that fails to
 * lift is far worse than the flicker it replaces — it is a blank site.
 *
 * Four things keep that from happening:
 *
 *  1. **A hard timeout.** The cloak removes itself after `timeoutMs` no matter what else
 *     happens — no network, a thrown error, a hung promise. Nothing else has to run.
 *  2. **A single exit funnel.** Every path out of `boot()` goes through `publish()`, which
 *     reveals. The timer is the backstop, not the mechanism.
 *  3. **It is never applied when it is not needed.** A cached configuration is read
 *     synchronously, so there is no request to wait for and no flicker to prevent. In
 *     practice only the first page of a session is ever cloaked.
 *  4. **Every step is guarded.** No `document`, no `head`, a style that will not append —
 *     each returns a handle that does nothing, and the page renders exactly as it would
 *     without the SDK installed.
 *
 * The cloak deliberately does *not* touch `body`'s own styles. Mida's published snippet sets
 * `position:relative;overflow:hidden` on the body, which mutates the host page's layout and
 * can reflow visibly when it is undone. A fixed-position pseudo-element covers the viewport
 * without the host page's box model participating at all.
 */

/** Element id, so a second initialisation finds the existing cloak rather than stacking one. */
const STYLE_ID = "routely-cloak";

/**
 * How long the page may stay hidden.
 *
 * Much shorter than the 3s config timeout on purpose: if the request is that slow the visitor
 * is better served by the control page than by a blank one, and the redirect still happens when
 * the answer lands. Mida's published snippet uses 2000ms.
 *
 * 1000ms is the deliberate other end of that trade. The config response is CDN-cached with
 * `s-maxage=60`, so the overwhelming majority of requests are served from an edge node in well
 * under 100ms and never come near this cap. What the cap actually governs is the bad tail — a
 * cold start, a slow mobile connection — and there the question is which is worse to show:
 * a blank page, or the control page briefly. A blank page looks broken, and it looks broken on
 * exactly the visits that are already going badly. A second is about as long as a visitor will
 * tolerate a blank screen before concluding the site is down, so that is where the line sits:
 * long enough that a merely sluggish request still resolves under cover, short enough that a
 * genuinely stuck one falls back to a working page rather than a broken-looking one.
 */
export const DEFAULT_CLOAK_MS = 1000;

/** Ceiling on the configured value — a typo in a data attribute must not blank a site. */
const MAX_CLOAK_MS = 4000;

const DEFAULT_BACKGROUND = "#fff";

/**
 * Colours only, and conservatively.
 *
 * The value comes from the host page's own script tag, so this is not a privilege boundary —
 * whoever sets it already controls the page. It exists so a stray `}` cannot escape the rule
 * and silently corrupt the customer's stylesheet, which would be a confusing failure to
 * attribute back to the SDK.
 */
const SAFE_BACKGROUND = /^[#(),.%\s\w-]{1,64}$/;

export interface CloakOptions {
  timeoutMs?: number;
  background?: string;
}

export interface Cloak {
  /** Removes the cloak. Idempotent, never throws, cancels the timeout. */
  reveal(): void;
}

/** A handle that does nothing, returned whenever cloaking is impossible or unnecessary. */
const NOOP: Cloak = { reveal() {} };

export function clampCloakMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return DEFAULT_CLOAK_MS;
  return Math.min(value, MAX_CLOAK_MS);
}

export function sanitizeBackground(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_BACKGROUND;
  return SAFE_BACKGROUND.test(trimmed) ? trimmed : DEFAULT_BACKGROUND;
}

/**
 * The rule that hides the page.
 *
 * `!important` throughout, because the host page's own stylesheets are linked *after* this
 * element in document order and would otherwise win on equal specificity. `position:fixed`
 * covers the viewport regardless of how tall the body is, and the overlay intentionally does
 * not set `pointer-events:none` — content that cannot be seen should not be clickable either.
 */
export function cloakCss(background: string): string {
  return (
    "body::after{content:''!important;position:fixed!important;" +
    "top:0!important;right:0!important;bottom:0!important;left:0!important;" +
    `background:${background}!important;z-index:2147483647!important}`
  );
}

/**
 * Hides the page and returns the handle that reveals it again.
 *
 * Applied synchronously so it takes effect before the first paint. Every failure returns a
 * no-op handle: the caller's `reveal()` stays safe to call and the page is simply never
 * hidden, which is the correct degradation.
 */
export function applyCloak(doc: Document | undefined, options: CloakOptions = {}): Cloak {
  try {
    if (!doc) return NOOP;

    const head = doc.head ?? doc.getElementsByTagName("head")[0];
    if (!head) return NOOP;

    // A second boot on the same page must not stack a second style element, and must not hand
    // out a handle that reveals the first one out from under its owner.
    if (doc.getElementById(STYLE_ID)) return NOOP;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.appendChild(doc.createTextNode(cloakCss(sanitizeBackground(options.background))));
    head.appendChild(style);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let revealed = false;

    const reveal = (): void => {
      if (revealed) return;
      revealed = true;

      try {
        if (timer !== undefined) clearTimeout(timer);
        style.parentNode?.removeChild(style);
      } catch {
        // Nothing useful remains to do: the element is already detached, or the document is
        // being torn down by the navigation this cloak was covering.
      }
    };

    timer = setTimeout(reveal, clampCloakMs(options.timeoutMs));

    return { reveal };
  } catch {
    return NOOP;
  }
}
