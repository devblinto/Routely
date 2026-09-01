# Tracking SDK — build, hosting and deployment

How `packages/sdk` becomes `https://cdn.example.com/sdk.js`.

---

## 1. What the SDK is

A single, dependency-free browser bundle. No npm package for customers to install, no module
graph, no build step on their side — installation is one tag:

```html
<script src="https://cdn.example.com/sdk.js" data-site-id="rt_abc123"></script>
```

The install screen pairs it with a short inline anti-flickering script above it, which is
optional and covered in §5. Everything below concerns the bundle itself.

That is what makes it framework-independent: it asks nothing of the host page beyond a
`<script>` element, so the same file runs on WordPress, WooCommerce, React, Next.js, Shopify
and hand-written HTML.

| Property | Value |
| --- | --- |
| Language | Vanilla TypeScript, no framework, no runtime dependencies |
| Output | One IIFE file, `dist/sdk.js`, plus a source map |
| Target | ES2019 |
| Size budget | **6 kB gzipped — the build fails if exceeded** |
| Current size | ~4.6 kB raw · ~2.1 kB gzip · ~1.9 kB brotli |

### What it does today

1. Reads `data-site-id` from its own `<script>` tag.
2. Resolves an anonymous visitor id, persisting it across visits and across the redirect.
3. Fetches `/api/v1/config?siteId=…` and caches it for the server-supplied TTL.
4. Matches the normalised current URL against each active experiment's control URL.
5. Reads the visitor's stored assignment, or draws one 50/50 and persists it.
6. Reports the assignment and page view to `/api/v1/events` with `sendBeacon`.
7. Redirects variant visitors to the variant URL, or leaves control visitors in place.
8. Measures approximate visible time on the page and reports it incrementally.
9. Records a conversion when the page matches an experiment's goal URL **and** the visitor
   already holds an assignment for it.
10. Exposes the result on `window.routely` for debugging.

---

## Conversions

A conversion is a visitor who was **in** an experiment reaching the page that experiment counts
as success — a thank-you or order-confirmation page. Both conditions are required, and the
second is what makes the number mean anything: someone who reaches `/thank-you` without ever
having been bucketed did not convert *in this experiment*, and counting them would credit the
test for traffic it never touched.

### Once per assignment, enforced three times

| Layer | Catches |
| --- | --- |
| In-instance guard | A second copy of the SDK on the same page load |
| `localStorage` marker (never expires) | A refresh, a return visit tomorrow, a second tab |
| **`conversions.assignmentId` unique constraint** | Everything else, including a forged request |

The database constraint is the only one that actually guarantees it — the client is precisely
what cannot be trusted to have asked once. The marker lives in `localStorage` rather than
`sessionStorage` because a conversion is once per assignment for the life of the experiment,
not once per session.

### Server-side validation

Three checks, each closing a way the headline number could be moved by a crafted request:

1. **The URL must match the experiment's configured goal.** Otherwise the URL is whatever the
   client says it is, and a conversion could be booked from anywhere.
2. **The assignment must already exist.** Every other event type may create one — that is the
   point of an `assignment` event — but a conversion arrives later, by which time the
   assignment has had a full page load to reach the server. Creating one here would let a
   forged request invent a visitor, choose their arm, and convert them.
3. **The stored arm wins.** A payload claiming the other side does not move the visitor.

### Known limitation: cross-origin goals

The assignment lives in `localStorage`, which is per-origin. A conversion page on a **different
origin** from where the visitor was assigned will not see their assignment, and the conversion
is not recorded. The redirect handoff carries identity from control to variant, but no such
handoff exists for an arbitrary later navigation.

In practice most setups keep control, variant and goal on one origin, where this does not
arise. A test spanning `acme.com` and `shop.acme.com` will under-count conversions on the
other origin.

---

## Time on page is approximate — and cannot be otherwise

This deserves stating plainly, because the number looks precise and is not.

**A browser will not tell a script how long a person looked at a page.** What it exposes is
whether the *document* is visible, which is a far weaker signal. The SDK measures document
visibility — starting a timer when the page is visible, pausing on `visibilitychange` to
hidden, resuming when visible again — and calls the result engaged time because that is the
closest honest approximation available.

### What inflates it

- A tab left open on a monitor nobody is looking at counts every second as engaged.
- On most browsers a tab that is visible but sitting *behind* another window still counts.
- A person who walks away mid-article is indistinguishable from one reading slowly.

### What deflates it

- Time after the last beacon is lost. A crash, a force-quit, or a browser that drops the final
  `sendBeacon` truncates the measurement silently — and that is more likely on slow devices.
- A visitor who never triggers a lifecycle event contributes only what was already flushed.
- Storage or network being blocked drops reports entirely.

### Why it is still worth measuring

Both arms are measured **the same way**, so the bias is shared and largely cancels in the
comparison. "The variant held attention 40% longer than the control" is a defensible reading.
"Visitors spend 25 seconds on this page" is not, and neither is comparing the figure against
one from another analytics tool that measures something different.

### How it is measured

| Decision | Reasoning |
| --- | --- |
| `visibilitychange`, not `blur`/`focus` | Clicking devtools or a second monitor should not read as leaving the page |
| `pagehide`, not `beforeunload` | `beforeunload` disqualifies the page from the back/forward cache, slowing navigation for the customer's visitors |
| `performance.now()`, not `Date.now()` | Monotonic: an NTP correction or time-zone change cannot show up as an eleven-hour read |
| Reported as **deltas**, not a running total | A dropped final beacon costs the tail rather than the entire measurement |
| Flushes below 1s are held back | Flicking between tabs would otherwise generate a request per switch |
| A single interval is capped at 6 hours | A laptop that slept with the tab open is not a reader |
| Finalisation is idempotent | `pagehide` and `visibilitychange` can both fire during one teardown |

The control page is deliberately **not** measured when the visitor is about to be redirected:
they are there for milliseconds, and counting it would drag the control arm's average down for
a reason unrelated to the page.

### Aggregation

`avgVisibleMs` is total reported visible time divided by **page views**, per arm — page views
being the unit the measurement is actually taken in. Any interface showing it must label it as
approximate.

### What it never does

- **Carry a secret.** The only credential-shaped value it knows is the public site id, which
  is visible in page source by design and permits nothing beyond recording activity for one
  website. No database URL, no `AUTH_SECRET`, no OAuth credentials — none of these exist in
  the bundle, and the build would have to import server code to include them.
- **Send cookies.** The config request uses `credentials: "omit"`, so the customer's cookies
  are never attached, and the CDN origin has no cookies of its own.
- **Break the page.** Every failure path — storage denied, network blocked, malformed
  response, timeout — ends with the SDK doing nothing. Nothing throws into the host page.
- **Block the page.** The tag loads synchronously (so a future redirect can be decided before
  paint), but the work is asynchronous and never gates rendering.

---

## 2. Anonymous visitor identity

A random v4 UUID, derived from nothing about the person — no IP, no user agent, no
fingerprint. It answers one question: *have I seen this browser on this site before?*

Storage is layered, and the id is written back to **every** available layer whenever it is
read. That heals the common asymmetry where a cookie survives but `localStorage` was cleared,
so a visitor is not re-bucketed just because one mechanism was dropped.

| Order | Mechanism | Why |
| --- | --- | --- |
| 1 | `localStorage` | Survives restarts; not sent with every HTTP request |
| 2 | Cookie (`SameSite=Lax`, `Secure` on HTTPS, 1 year) | Works where storage is denied |
| 3 | In-memory | Last resort — the visitor is new each page load, but the SDK still runs |

Availability is established with a **read-write probe**, not a truthiness check: Safari in
private browsing exposes `localStorage` and then throws on the first write, so an object that
merely exists proves nothing.

A stored value that does not match the ingestion API's format is discarded and replaced.
Storage is shared with the host page, which may write anything under any key.

---

## 3. Building

```bash
npm run sdk:build                          # production: minified, size-checked
node packages/sdk/build.mjs --watch        # rebuild + republish on change
npm run test --workspace @routely/sdk      # 20 unit tests, no DOM required
```

`ROUTELY_API_BASE` is baked into the bundle at build time and defaults to
`http://localhost:3000`. **It must be set for production builds**, because it is the origin
every installed snippet will call:

```bash
ROUTELY_API_BASE=https://app.example.com npm run sdk:build
```

The build writes:

```
packages/sdk/dist/sdk.js                  the artifact
apps/web/public/sdk/v1/sdk.js             published copy, served by the app at /sdk.js
apps/web/public/sdk/v1/sdk.js.map
apps/web/public/sdk/v1/build.json         apiBase, target and sizes of this build
```

The size budget is enforced, not advisory — the build exits non-zero when the gzipped bundle
exceeds 6 kB. This runs on every page of every customer site, so growth should be a deliberate
decision rather than a drift nobody noticed.

Tests run in plain Node with no DOM. That is possible because the browser-dependent parts are
reached through injectable interfaces, which keeps the run fast and avoids a jsdom dependency
in a package whose whole point is having none.

---

## 4. Hosting assumptions

Two hostnames, deliberately separate:

| Host | Serves | Why separate |
| --- | --- | --- |
| `app.example.com` | Dashboard + API (Next.js container) | Session-bearing, dynamic, never cached |
| `cdn.example.com` | `sdk.js` only, from nginx directly | Must stay up while the app deploys; no Node in the request path; **no cookies** |

Splitting them matters for a reason beyond performance: the dashboard's session cookies are
scoped to `app.example.com`, so they are never sent with an SDK request from a customer's
site.

### Caching

| Path | Cache-Control | Reasoning |
| --- | --- | --- |
| `/sdk.js` | `max-age=300, stale-while-revalidate=86400` | A moving pointer. A bad bundle must not be stuck in browser caches. |
| `/v1/*` | `max-age=31536000, immutable` | The version is in the path, so the bytes never change. |
| `*.map` | `max-age=3600` | Useful for debugging an install; contains no secret — the bundle is public. |

All three send `Access-Control-Allow-Origin: *`. A classic `<script>` tag does not need CORS,
but this makes the bundle usable from a module import or a `fetch` too.

### Compose

The SDK is a static file, so nginx serves it from a volume rather than proxying to the app:

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - sdk-assets:/srv/sdk:ro           # cdn.example.com document root
      - certbot-conf:/etc/letsencrypt:ro
      - certbot-www:/var/www/certbot:ro
    depends_on: [web]

  web:
    build: { context: .., dockerfile: infra/Dockerfile }
    expose: ["3000"]
    volumes:
      - sdk-assets:/app/apps/web/public/sdk   # the build writes here; nginx reads it
    env_file: [.env]
    depends_on:
      postgres: { condition: service_healthy }

volumes:
  sdk-assets:
  certbot-conf:
  certbot-www:
```

The `sdk-assets` volume is the handoff: the web image's build step produces the bundle into
`public/sdk`, and nginx serves the same directory read-only as `/srv/sdk`. `cdn.example.com/sdk.js`
resolves to `/srv/sdk/v1/sdk.js` via `try_files`.

### Deploying a new bundle

```bash
# On the VPS
git pull
ROUTELY_API_BASE=https://app.example.com docker compose build web
docker compose up -d web              # repopulates the sdk-assets volume
curl -sI https://cdn.example.com/sdk.js | grep -iE 'HTTP|cache-control|access-control'
```

No nginx restart is needed — it serves whatever is in the volume.

### Rolling back

Because `/sdk.js` is only cached for five minutes, redeploying the previous image restores the
old bundle for effectively all traffic within that window. That short TTL is the entire reason
the moving pointer and the immutable versioned path are kept separate.

---

## 5. Configuration reference

| Variable | Where | Purpose |
| --- | --- | --- |
| `ROUTELY_API_BASE` | SDK build | Baked into the bundle; the origin installed snippets call |
| `NEXT_PUBLIC_SDK_URL` | Dashboard runtime | The URL rendered into the install snippet |

These are two halves of one decision and must agree: the snippet points at
`NEXT_PUBLIC_SDK_URL`, and the bundle served there calls `ROUTELY_API_BASE`.

Per-site overrides, for debugging one installation without rebuilding:

| Attribute | Default | Purpose |
| --- | --- | --- |
| `data-site-id` | _required_ | Public site id |
| `data-api` | build-time value | Override the API origin |
| `data-timeout` | `3000` | Config request timeout, in ms |
| `data-debug` | `false` | Log decisions to the console |

### The anti-flickering script

A redirect test has an unavoidable race. The tag is synchronous, so the SDK runs before the
page paints — but the *decision* needs the experiment configuration, and that is a network
request. While it is in flight the browser carries on parsing and paints the control page, so
a visitor bound for the variant sees the wrong page for as long as the request took. On a warm
connection that is a flash; on a cold serverless start it was measured at about a second.

The fix is to hide the page until the decision is made. **That overlay is created by a second
inline script the customer pastes above the tag, not by the bundle.** The install screen shows
both blocks together and they are copied as one.

```html
<!-- Routely anti-flickering script -->
<script>
var routelyTimeout = 1250;
!function(d,w,i,t){ /* … creates #routely-cloak, publishes w.__routelyReveal, clears after t */ }
(document,window,"routely-cloak",routelyTimeout);
</script>

<!-- Routely tracking script (place in <head>) -->
<script src="https://cdn.example.com/sdk.js" data-site-id="rt_abc123"></script>
```

The SDK's only involvement is ending the wait early: it calls `window.__routelyReveal()` the
moment it knows the visitor is staying. A redirect deliberately does *not* call it — the page
is being replaced, and revealing the control page for the duration of that navigation is the
exact flash the script exists to remove.

Three reasons it lives in the page rather than the bundle:

1. **It runs earlier than any bundle can.** There is no network request in front of an inline
   script, so it takes effect at parse time even when the CDN is slow.
2. **The timings belong to the customer.** `routelyTimeout` and the `#fff` background are plain
   values at the top of the script on their own page. A dark site, or a site on slow hosting,
   is a one-character edit — not a redeploy of ours, and not one number baked into a bundle
   that every customer shares.
3. **It lifts even if the SDK never arrives.** The timeout belongs to the pasted script, so a
   blocked, failed, or missing bundle cannot leave a page hidden. This is the failure that
   actually matters: a cloak that never lifts is a blank site, which is far worse than the
   flicker it replaces.

Installing the anti-flickering script is optional. Omit it and the tracking still works
exactly as before — you simply keep the flicker.

**Implementation notes.** Every declaration is `!important`, because the customer's own
stylesheets are linked *after* this element in document order and would otherwise win on equal
specificity. The overlay is a `position:fixed` `body::after` rather than styles applied to
`body` itself — Mida's published snippet sets `position:relative;overflow:hidden` on the body,
which mutates the host layout and can reflow visibly when it is undone; a fixed pseudo-element
covers the viewport regardless of document height and the host box model never participates.

**Verified in headless Chrome** against the snippet the dashboard actually generates: with the
config held at 900 ms the overlay is painting at 300 ms and 600 ms and is *never* lifted, the
visitor going straight to the variant; with no matching experiment the SDK lifts it at 904 ms,
as soon as the configuration lands; and **with the tracking script removed entirely the snippet
lifts itself at exactly 1250 ms.**

---

## 6. Known limitations

1. **Identity is per-origin.** A visitor on `www.acme.com` and `shop.acme.com` is two
   visitors, because `localStorage` is origin-scoped and the cookie is host-only. Cross-origin
   continuity arrives with the redirect handoff.
2. **No integrity hash in the snippet.** `/sdk.js` changes on deploy, so a fixed
   `integrity` attribute would break every install. Adding SRI would mean pinning customers to
   a versioned URL and giving up the ability to ship a fix centrally.
3. **`Math.random` is the last-resort id source** on browsers without `crypto`. Acceptable only
   because the value identifies nothing and grants nothing; a collision costs one miscounted
   visitor.
4. **The bundle is not pre-compressed at build time.** `gzip_static` is enabled, so dropping
   `.br`/`.gz` artifacts alongside it later requires no config change.
5. **No CDN in front of nginx.** Fine at this scale; a real CDN would sit in front of
   `cdn.example.com` and honour the same cache headers.
6. **The SDK does nothing with the config yet** — it fetches and exposes it. Assignment and
   redirecting are the next part.
