import type { NextRequest } from "next/server";

import { isBot } from "@/server/http/bot-filter";
import { clientAddress, rateLimit } from "@/server/http/rate-limit";
import { ingest } from "@/server/services/ingest.service";

/**
 * Public event ingestion for the tracking SDK.
 *
 *   POST /api/v1/events
 *
 * Unauthenticated, because it is called by a script in a visitor's browser. Everything that
 * makes it safe against forged ownership lives in `ingest.service.ts`; this handler is
 * responsible for the transport concerns — body size, rate limiting, bot filtering and CORS.
 */

/** The Prisma adapter uses a Node database driver, so this cannot run on the Edge runtime. */
export const runtime = "nodejs";

/** Rejects a body large enough to be an attack rather than a batch of events. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Per-IP, per-site limits.
 *
 * A busy visitor generates a handful of requests a minute; a page in a redirect loop or a
 * script hammering the endpoint generates hundreds. The limit sits far above the first and
 * well below the second, so it never touches real traffic.
 */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

/**
 * CORS, kept to what is actually required.
 *
 * The SDK's request is deliberately a *CORS-simple* one — POST with `text/plain` and no custom
 * headers — so no preflight is triggered and no `Access-Control-Allow-Headers` is needed.
 *
 * `Access-Control-Allow-Origin: *` is required because the SDK runs on arbitrary customer
 * domains that cannot be enumerated in advance. It is safe here because the response carries
 * no data (`204`, empty body) and the endpoint reads no cookies: `credentials` is never
 * allowed, so there is no session for a third-party page to ride. It exists only so the
 * `fetch` fallback does not log a CORS error into the customer's console.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Every response is `204`, including for malformed input and rate limiting.
 *
 * The caller is a beacon: it cannot retry, it cannot act on an error, and by the time a
 * response arrives the page has usually navigated away. A status it would only log noisily
 * into the customer's console buys nothing, so failures are counted server-side instead. The
 * one exception is `429`, which carries `Retry-After` for any non-browser client that can use
 * it — browsers ignore both.
 */
function accepted() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function OPTIONS() {
  // The SDK never triggers a preflight, but a browser extension or a future non-simple
  // request might; answering costs four lines and avoids a mystery failure.
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Crawlers load pages; a crawler is not a visitor. Counting them would inflate whichever arm
  // happens to be crawled more, which is unrelated to the change being tested.
  if (isBot(request.headers.get("user-agent"))) {
    return accepted();
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return accepted();
  }

  let payload: unknown;

  try {
    // `sendBeacon` sends text/plain to stay CORS-simple and avoid a preflight before the page
    // unloads, so the body is parsed here rather than trusting the content type.
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return accepted();
    payload = JSON.parse(text);
  } catch {
    return accepted();
  }

  // Keyed on site *and* address: one noisy visitor must not exhaust the budget for a
  // customer's other visitors, and one customer's traffic must not affect another's.
  const siteId =
    typeof payload === "object" && payload !== null && "siteId" in payload
      ? String((payload as { siteId: unknown }).siteId).slice(0, 64)
      : "unknown";

  const limit = rateLimit(
    `events:${siteId}:${clientAddress(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: { ...CORS_HEADERS, "Retry-After": String(limit.retryAfter) },
    });
  }

  try {
    await ingest(payload);
  } catch (error) {
    // A failure here must never surface on a customer's page.
    console.error("[routely] ingestion failed", error);
  }

  return accepted();
}
