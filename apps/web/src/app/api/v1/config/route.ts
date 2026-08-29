import type { NextRequest } from "next/server";

import type { ConfigResponse, ExperimentConfig } from "@routely/sdk/contract";
import { SDK_PROTOCOL_VERSION } from "@routely/sdk/contract";
import * as experimentRepo from "@/server/repositories/experiment.repository";
import * as websiteService from "@/server/services/website.service";
import { configRequestSchema } from "@/validation/tracking";

/**
 * Public experiment configuration for the tracking SDK.
 *
 *   GET /api/v1/config?siteId=rt_…
 *
 * Unauthenticated by necessity — it is called by a script running on a visitor's browser on
 * the customer's own site — and therefore deliberately narrow. It exposes exactly what the
 * SDK needs to decide what to do on a page, and nothing that identifies the account, the
 * website record, or any experiment that is not currently running.
 *
 * **Only ACTIVE experiments are published.** That is the mechanism behind the lifecycle
 * guarantees: a draft cannot affect a visitor because it never reaches the browser, and
 * pausing takes effect as soon as caches expire because the experiment simply stops being
 * listed. There is no separate "is this paused?" check on the client to get wrong.
 */

/** The Prisma adapter uses a Node database driver, so this cannot run on the Edge runtime. */
export const runtime = "nodejs";

/**
 * How long a browser may reuse this document.
 *
 * Short, because it is the propagation delay for pausing an experiment: a visitor with a
 * cached config keeps the old configuration until it expires. `stale-while-revalidate` keeps
 * the request off the critical path while the refresh happens in the background.
 */
const TTL_SECONDS = 60;
const STALE_SECONDS = 300;

const CORS_HEADERS = {
  // The SDK runs on customer domains, which are arbitrary and not known in advance.
  // Safe here because the response is identical for every caller and depends on no cookie:
  // there is no session to ride, so a permissive origin grants nothing a direct fetch lacks.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status: number, cacheable: boolean) {
  return Response.json(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": cacheable
        ? `public, max-age=${TTL_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`
        : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const parsed = configRequestSchema.safeParse({
    siteId: request.nextUrl.searchParams.get("siteId") ?? "",
  });

  if (!parsed.success) {
    // A malformed id is a broken installation, so say so — but do not cache the answer, in
    // case the snippet is corrected a moment later.
    return json({ error: "Invalid siteId" }, 400, false);
  }

  const website = await websiteService.resolveWebsiteByPublicSiteId(parsed.data.siteId);

  // An unknown-but-well-formed id returns an empty configuration rather than 404. A deleted
  // website leaves its snippet installed on pages nobody will update, and those pages should
  // quietly do nothing instead of logging an error on every view. The SDK's behaviour is the
  // same either way: no experiments, no redirect.
  const experiments = website ? await experimentRepo.listActiveExperiments(website.id) : [];

  const body: ConfigResponse = {
    v: SDK_PROTOCOL_VERSION,
    siteId: parsed.data.siteId,
    ttl: TTL_SECONDS,
    experiments: experiments.map((experiment): ExperimentConfig => ({
      id: experiment.id,
      control: { url: experiment.controlUrl, match: experiment.controlMatchType },
      controlWeight: experiment.controlWeight,
      variants: experiment.variants.map((variant) => ({
        id: variant.id,
        url: variant.url,
        weight: variant.weight,
      })),
      goal: { url: experiment.conversionUrl, match: experiment.conversionMatchType },
      trafficAllocation: experiment.trafficAllocation,
    })),
  };

  return json(body, 200, true);
}
