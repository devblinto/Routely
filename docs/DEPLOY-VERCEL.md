# Deploying to Vercel

Routely was designed for a Contabo VPS with Docker and Nginx (see `SDK-DEPLOYMENT.md`). Vercel
works, and this is what it takes — including the three things that behave differently there and
one that stops working entirely.

---

## 1. Before you start: what changes on Vercel

| | Self-hosted (designed for) | Vercel |
| --- | --- | --- |
| Server | One long-lived Node process | Many short-lived function instances |
| Database | Postgres in Compose, private network | External, over the public internet |
| Connections | One pool, reused | One pool **per instance** — needs a pooler |
| `sdk.js` | Nginx on `cdn.example.com`, cookie-less | Vercel CDN on the app domain |
| Rate limiting | Works — shared process memory | **Effectively disabled** — see §7 |
| Migrations | Container entrypoint | Build step |

Two of these are real losses. Read §7 before you decide.

---

## 2. Get a Postgres database

Vercel runs no database. You need one reachable from the public internet, and it **must** be
accessed through a connection pooler — a serverless platform opens a new pool per instance, and
a modest traffic spike will exhaust `max_connections` on an unpooled database.

Any of these work. All offer a free tier big enough for this:

| Provider | Use the connection string labelled |
| --- | --- |
| [Neon](https://neon.tech) | **Pooled** (contains `-pooler`) |
| [Supabase](https://supabase.com) | **Transaction pooler**, port `6543` |
| Vercel Postgres (Neon under the hood) | `POSTGRES_PRISMA_URL` |

Two URLs matter and they are not interchangeable:

- **Pooled** — what the running app uses. Goes in `DATABASE_URL`.
- **Direct** — what migrations use. Poolers in transaction mode cannot run the DDL and advisory
  locks Prisma migrations need.

If your provider gives both, set `DATABASE_URL` to the pooled one and add `directUrl` to the
datasource block:

```prisma
datasource db {
  provider  = "postgresql"
  directUrl = env("DIRECT_DATABASE_URL")
}
```

If you only have one URL (Supabase session pooler on `5432`, for example), skip `directUrl` —
migrations will run against it fine.

---

## 3. Import the project

1. Push to GitHub — done: `github.com/devblinto/Routely`.
2. Vercel → **Add New → Project** → import the repo.
3. **Root Directory: leave it at the repository root.** Do *not* set it to `apps/web`. The build
   runs `npm run vercel-build` from the root so npm workspaces resolves `@routely/sdk`, and
   `vercel.json` already points the output at `apps/web/.next`.
4. Framework preset: **Next.js** (detected automatically).
5. Do not deploy yet — add the environment variables first, or the first build will fail on
   missing `DATABASE_URL`.

`vercel.json` at the repo root already sets:

```json
{
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "apps/web/.next"
}
```

`vercel-build` runs `prisma migrate deploy` and then the build, so **every deployment applies
pending migrations before the new code goes live**.

---

## 4. Environment variables

Set these in **Settings → Environment Variables**, for Production *and* Preview.

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | pooled connection string | **Must** be the pooled one |
| `DIRECT_DATABASE_URL` | direct connection string | Only if you added `directUrl` |
| `AUTH_SECRET` | `openssl rand -base64 32` | Generate a **new** one; do not reuse local |
| `AUTH_URL` | `https://your-app.vercel.app` | Exact origin, no trailing slash |
| `GOOGLE_CLIENT_ID` | from Google Console | |
| `GOOGLE_CLIENT_SECRET` | from Google Console | Rotate if it was ever pasted into a chat |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Renders into install snippets |
| `NEXT_PUBLIC_SDK_URL` | `https://your-app.vercel.app/sdk.js` | The URL customers paste |
| `ROUTELY_API_BASE` | `https://your-app.vercel.app` | **Build-time** — baked into the SDK bundle |
| `AUTH_DEV_BYPASS` | *do not set* | Forced off in production anyway |

### The two that are easy to get wrong

**`ROUTELY_API_BASE` is read at build time, not runtime.** It is compiled into `sdk.js`, which
is what every customer's browser calls. Change it and you must **redeploy** — an environment
variable edit alone changes nothing, because the bundle is already built.

**`AUTH_URL` must be the origin you actually visit.** `trustHost` is enabled for the reverse
proxy, and `AUTH_URL` is what stops a forged `Host` header redirecting the OAuth callback
elsewhere. The two are only safe together — see `AUTH.md`.

### Preview deployments and auth

Every preview gets a unique URL, but `AUTH_URL` is fixed, so **Google sign-in will not work on
preview deployments** unless you register each preview URL with Google — which is impractical.

Options, in order of sanity:

1. Accept it. Use previews for UI review, and Production for anything touching auth.
2. Give previews their own Google OAuth client with a wildcard-ish set of registered URIs
   (Google does not support wildcards, so this means registering them by hand).
3. Set `AUTH_URL` per-deployment via the Vercel CLI. Fiddly.

---

## 5. Google OAuth

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), on
your OAuth client:

| Field | Add |
| --- | --- |
| Authorised JavaScript origins | `https://your-app.vercel.app` |
| Authorised redirect URIs | `https://your-app.vercel.app/api/auth/callback/google` |

Exact match — no trailing slash, `https` not `http`. A mismatch gives Google's
`redirect_uri_mismatch` before Auth.js is ever reached.

If the consent screen is still in **Testing**, only accounts listed under *Test users* can sign
in. Publish it when you want anyone else to.

**Keep the localhost entries** — they are what let you keep developing.

---

## 6. Deploy and verify

```bash
# After the first deploy, from your machine:
APP=https://your-app.vercel.app

curl -sI $APP/sdk.js | grep -iE 'HTTP|cache-control|access-control'
#   200 · public, max-age=300, stale-while-revalidate=86400 · *

curl -s "$APP/api/v1/config?siteId=rt_00000000000000000000000000000000"
#   {"v":1,"siteId":"rt_0000…","experiments":[],"ttl":60}   ← unknown site, empty config

curl -s -o /dev/null -w '%{http_code}\n' $APP/experiments
#   307 → /login    (protected)
```

Then in a browser: sign in with Google, add a website, and confirm the install snippet shows
your Vercel URL rather than `localhost`.

To confirm migrations ran, check the build log for `prisma migrate deploy` output, or:

```bash
npx prisma migrate status     # locally, pointed at the same DATABASE_URL
```

---

## 7. What is worse on Vercel — read this

### Rate limiting stops working

`server/http/rate-limit.ts` is an in-memory counter. That was a documented, accepted trade for
a single container. On Vercel it is close to useless: each function instance has its own memory,
instances are created and destroyed constantly, and an attacker distributing requests gets a
fresh budget on each one.

The ingestion endpoint (`/api/v1/events`) is public and unauthenticated. Without working rate
limiting it is open to anyone who finds a `publicSiteId` — which is, by design, visible in the
page source of every customer site. They cannot read anything, but they can **write junk events
into a customer's experiment results**.

Fix it with a shared store before taking real traffic. `rateLimit()` is one function; swap the
`Map` for Upstash Redis or Vercel KV and the call sites do not change.

### The SDK is served from the app's own domain

Self-hosted, `sdk.js` comes from `cdn.example.com` — a separate, cookie-less origin, served by
Nginx with no Node process in the path. On Vercel it is served from the app domain by the CDN.

Consequences:

- **It is fast and cached** — Vercel's CDN honours the `Cache-Control` headers in
  `next.config.ts`, so this part is fine.
- **Dashboard cookies are scoped to the same domain.** They are `SameSite=Lax` and are not sent
  on a cross-site script load, so this is not a leak — but the separation the original design
  had is gone.
- **A bad deploy takes the SDK down with the dashboard.** Self-hosted, `sdk.js` kept serving
  while the app restarted.

Acceptable for an MVP. If it matters later, put the bundle on a real CDN or an S3-backed domain
and point `NEXT_PUBLIC_SDK_URL` at it — nothing else changes.

### Cold starts sit in front of a redirect decision

`/api/v1/config` is what the SDK calls before deciding whether to redirect. A cold start adds
latency there, and that latency is visible to *the customer's* visitors as a longer flash of the
control page. The SDK's 3-second timeout means it fails safe rather than hanging, but the flash
gets worse.

Mitigations: keep the function warm with a cron ping, or — better — accept that the config
response is cacheable (`s-maxage=60`) and most requests never reach the function at all.

---

## 8. Things that do *not* need changing

For the record, so you do not go looking:

- **`export const runtime = "nodejs"`** is already set on all three API routes. Prisma needs it;
  the Edge runtime would fail.
- **`output: "standalone"`** is now conditional on `process.env.VERCEL`. Docker still gets it,
  Vercel does not — Vercel rejects it.
- **The connection pool** is capped at 1 per instance on serverless (`db.ts`), with a shorter
  idle timeout. This bounds the damage; the pooler is what actually multiplexes.
- **`prisma generate`** already runs in the app's `build` script, so the client is always
  generated from the schema in CI.
- **`outputFileTracingRoot`** already points at the monorepo root.

---

## 9. Rolling back

Vercel keeps every deployment. **Deployments → ⋯ → Promote to Production** on the previous one.

The important caveat: **rolling back code does not roll back the database.** `vercel-build`
already applied the migrations, and Prisma has no down-migrations here. If a deploy ships a
destructive migration, the rollback restores the old code against the *new* schema — which may
not work.

So: take a database backup before any deploy that includes a migration, and prefer
expand/contract migrations (add nullable, backfill, deploy, only then drop) so the previous
version of the code still runs against the new schema. `DATABASE.md` covers the pattern.

---

## 10. Quick checklist

- [ ] Postgres provisioned, **pooled** URL to hand
- [ ] Repo imported, Root Directory left at the repository root
- [ ] All nine environment variables set for Production
- [ ] `AUTH_SECRET` freshly generated
- [ ] `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `ROUTELY_API_BASE` all the same origin
- [ ] `NEXT_PUBLIC_SDK_URL` ends in `/sdk.js`
- [ ] Google redirect URI added for the Vercel domain
- [ ] Deployed; `/sdk.js` returns 200 and `/experiments` returns 307
- [ ] Signed in with Google end to end
- [ ] **Rate limiting replaced with a shared store before real traffic** (§7)
