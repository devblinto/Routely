# @routely/sdk

Framework-independent browser tracking SDK for Routely redirect experiments.

Vanilla TypeScript, no runtime dependencies, bundled by esbuild into a single IIFE
(`dist/sdk.js`) that is copied into `apps/web/public/sdk/v1/sdk.js` and served from there.
Because installation is a plain script tag, the same snippet works on WordPress, WooCommerce,
React, Next.js and static HTML sites.

## Build

```bash
npm run build --workspace @routely/sdk     # one-off, minified
node build.mjs --watch                     # rebuild + republish on change
```

`ROUTELY_API_BASE` is baked into the bundle at build time (default `http://localhost:3000`)
and can be overridden per-site with `data-api`.

## Snippet

```html
<script src="https://cdn.example.com/sdk.js" data-site-id="rt_abc123"></script>
```

Load it synchronously in `<head>` — no `async`/`defer` — so the redirect decision happens
before first paint.

| Attribute            | Default          | Purpose                                     |
| -------------------- | ---------------- | ------------------------------------------- |
| `data-site-id`       | _required_       | Public site id — identifies a **website**   |
| `data-api`           | build-time value | Override the API origin                     |
| `data-cloak`         | `true`           | Hide the page until the decision is made    |
| `data-cloak-timeout` | `1500`           | Hard ceiling, in ms, on how long it hides   |
| `data-debug`         | `false`          | Log decisions to the console                |

One snippet serves every experiment on a website: `data-site-id` identifies the website, and
which experiments are running is resolved at runtime. Adding, pausing or deleting an
experiment never requires re-installing the snippet.

## Structure

| File            | Responsibility                                                        |
| --------------- | --------------------------------------------------------------------- |
| `contract.ts`   | Wire types shared with the ingestion API. Type-only, no runtime.      |
| `env.ts`        | Guarded access to storage, cookies and crypto. Never throws.          |
| `identity.ts`   | Anonymous visitor id: layered persistence, cross-origin handoff.      |
| `url.ts`        | Normalisation, EXACT/PREFIX matching, handoff parameters.             |
| `assignment.ts` | Random 50/50 draw, persisted so it is never repeated.                 |
| `redirect.ts`   | The decision, and four independent loop guards.                       |
| `config.ts`     | Fetches and caches the published experiment configuration.            |
| `transport.ts`  | `fetch` with a timeout. Resolves `null` on any failure.               |
| `track.ts`      | `sendBeacon` reporting, with a `fetch(keepalive)` fallback.           |
| `index.ts`      | Entry point: options, boot sequence, orchestration.                   |

Page view, engaged time and conversion tracking are not implemented yet.

## Runtime flow

1. Read `data-site-id` from the script tag.
2. Read the handoff parameters, if this page load is the result of a redirect.
3. Resolve the visitor id — adopting a handed-over one only when nothing is stored.
4. Fetch the configuration (cached per session for the server-supplied TTL).
5. Find an active experiment whose **control** URL matches the normalised current URL.
6. Read the stored assignment, or draw one 50/50 and persist it.
7. Report the assignment with `sendBeacon`, before any navigation.
8. `CONTROL` — stay. `VARIANT` — `location.replace()` to the variant, carrying the handoff.

### Loop guards

Four, each sufficient on its own for the case it covers:

1. Only the control URL is a trigger; the variant is never matched.
2. Already on the variant — catches a variant nested under a `PREFIX` control.
3. Arrived by this experiment's own redirect, per the handoff parameters. Works across
   origins, where storage does not.
4. A session counter incremented *before* navigating, capped at one redirect per experiment.

Plus a final check that the target is not the page already displayed.
