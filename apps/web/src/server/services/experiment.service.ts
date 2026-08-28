import "server-only";

import { randomBytes } from "node:crypto";

import type { Experiment, ExperimentStatus, Website } from "@/generated/prisma/client";
import { controlUrlsConflict, isSameSite } from "@/lib/url";
import { conflict, notFound, validationFailed } from "@/server/errors";
import * as experimentRepo from "@/server/repositories/experiment.repository";
import * as websiteRepo from "@/server/repositories/website.repository";
import { parseOrThrow } from "@/server/validate";
import {
  changeExperimentStatusSchema,
  createExperimentSchema,
  updateExperimentSchema,
} from "@/validation/experiment";

/**
 * Experiment business logic.
 *
 * As with websites, `actorUserId` is threaded into every query — here through the parent
 * website relation — so ownership is enforced in the same statement that reads or writes.
 *
 * Two rules live here rather than in the Zod schemas, because both need data the schema
 * cannot see: the same-site rule needs the website's domain, and the conflict rule needs the
 * website's other experiments.
 */

/**
 * The MVP splits traffic evenly and offers no control over it.
 *
 * The column is an integer so uneven splits need no migration later; pinning the value here
 * rather than trusting the request means a crafted submission cannot skew a running test.
 */
export const MVP_VARIANT_SPLIT = 50;

/** The fields the same-site rule applies to. */
const URL_FIELDS = ["controlUrl", "variantUrl", "conversionUrl"] as const;

/**
 * Permitted status transitions.
 *
 * Modelling this as data rather than a chain of `if`s means the rules are visible in one
 * place and the UI can derive which buttons to show from the same table. ARCHIVED is
 * terminal: an archived experiment keeps its collected data but can never collect more.
 */
const ALLOWED_TRANSITIONS: Record<ExperimentStatus, readonly ExperimentStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function listExperiments(actorUserId: string, websiteId: string): Promise<Experiment[]> {
  return experimentRepo.listExperimentsForWebsite(websiteId, actorUserId);
}

/** All the actor's experiments, filtered, for the experiments list page. */
export function listAllExperiments(
  actorUserId: string,
  query: experimentRepo.ExperimentQuery = {},
): Promise<experimentRepo.ExperimentWithWebsite[]> {
  return experimentRepo.listExperimentsForUser(actorUserId, query);
}

export function countByStatus(actorUserId: string) {
  return experimentRepo.countExperimentsByStatus(actorUserId);
}

export async function getExperiment(
  actorUserId: string,
  experimentId: string,
): Promise<experimentRepo.ExperimentWithWebsite> {
  const experiment = await experimentRepo.findExperimentForUser(experimentId, actorUserId);

  if (!experiment) {
    throw notFound("That experiment does not exist.");
  }

  return experiment;
}

/**
 * Every experiment URL must live on the website it belongs to.
 *
 * Without this, an experiment could redirect a website's visitors to an unrelated domain —
 * the customer's own visitors, sent somewhere they never agreed to. It also prevents the
 * quieter mistake of pointing at a staging host and wondering why nothing is recorded.
 *
 * The conversion URL is held to the same rule: conversions are attributed by the snippet
 * running on the goal page, and that snippet belongs to this website. A goal on a different
 * domain could never record anything, so accepting it would only produce a silent dud.
 */
function assertSameSite(
  website: Pick<Website, "domain">,
  urls: { controlUrl: string; variantUrl: string; conversionUrl: string },
): void {
  const offenders: Record<string, string[]> = {};

  // Iterate an explicit field list, not `Object.entries(urls)`: callers pass the whole parsed
  // experiment, and TypeScript does not apply excess-property checks to a non-literal, so
  // entry iteration would silently validate `name` and `variantSplit` as if they were URLs.
  for (const field of URL_FIELDS) {
    if (!isSameSite(urls[field], website.domain)) {
      offenders[field] = [`Must be a URL on ${website.domain} or one of its subdomains.`];
    }
  }

  if (Object.keys(offenders).length > 0) {
    throw validationFailed(
      `Experiment URLs must be on ${website.domain}, the domain this website is configured for.`,
      offenders,
    );
  }
}

/**
 * Refuses a control URL already claimed by another active experiment on the same website.
 *
 * Two active experiments matching the same page would each try to bucket and redirect the
 * same visitor, and the winner would come down to evaluation order — producing results that
 * silently mix two tests. Checked at creation and at edit so the problem surfaces while the
 * experiment is still a draft, and again on activation, which is the moment it becomes real.
 */
async function assertNoActiveConflict(
  websiteId: string,
  candidate: { url: string; match: Experiment["controlMatchType"] },
  excludeExperimentId?: string,
): Promise<void> {
  const active = await experimentRepo.listActiveExperimentsExcluding(
    websiteId,
    excludeExperimentId,
  );

  const clash = active.find((other) =>
    controlUrlsConflict(candidate, { url: other.controlUrl, match: other.controlMatchType }),
  );

  if (clash) {
    throw validationFailed(
      `“${clash.name}” is already running on that control URL. Pause or archive it before starting another test on the same page.`,
      { controlUrl: ["Another active experiment already targets this page."] },
    );
  }
}

export async function createExperiment(actorUserId: string, input: unknown): Promise<Experiment> {
  const data = parseOrThrow(createExperimentSchema, input, "Check the experiment setup.");

  // The website must belong to the actor; otherwise an experiment could be attached to
  // someone else's website by supplying its id.
  const website = await websiteRepo.findWebsiteForUser(data.websiteId, actorUserId);
  if (!website) {
    throw notFound("That website does not exist.");
  }

  assertSameSite(website, data);
  await assertNoActiveConflict(website.id, {
    url: data.controlUrl,
    match: data.controlMatchType,
  });

  return experimentRepo.createExperiment({
    websiteId: website.id,
    name: data.name,
    description: data.description ?? null,
    controlUrl: data.controlUrl,
    controlMatchType: data.controlMatchType,
    variantUrl: data.variantUrl,
    conversionUrl: data.conversionUrl,
    conversionMatchType: data.conversionMatchType,
    variantSplit: MVP_VARIANT_SPLIT,
    // Experiments always begin as drafts: nothing is redirected until someone activates it.
    status: "DRAFT",
  });
}

/**
 * Applies changes to an experiment.
 *
 * The caller may send a partial update, but the URL rules only make sense against the
 * complete configuration, so the stored record is merged with the changes before validation.
 * Editing the targets of a running experiment is rejected: existing visitors are already
 * bucketed against the old configuration, and mixing both under one experiment id would
 * silently corrupt the comparison.
 */
export async function updateExperiment(
  actorUserId: string,
  experimentId: string,
  changes: Record<string, unknown>,
): Promise<Experiment> {
  const existing = await getExperiment(actorUserId, experimentId);

  const merged = parseOrThrow(
    updateExperimentSchema,
    {
      experimentId,
      name: existing.name,
      description: existing.description ?? undefined,
      controlUrl: existing.controlUrl,
      controlMatchType: existing.controlMatchType,
      variantUrl: existing.variantUrl,
      conversionUrl: existing.conversionUrl,
      conversionMatchType: existing.conversionMatchType,
      variantSplit: existing.variantSplit,
      ...changes,
    },
    "Check the experiment setup.",
  );

  const targetsChanged =
    merged.controlUrl !== existing.controlUrl ||
    merged.variantUrl !== existing.variantUrl ||
    merged.conversionUrl !== existing.conversionUrl ||
    merged.controlMatchType !== existing.controlMatchType ||
    merged.conversionMatchType !== existing.conversionMatchType;

  if (targetsChanged && existing.status !== "DRAFT") {
    throw validationFailed(
      "This experiment has already started, so its URLs are fixed. Archive it and create a new one to test different pages.",
    );
  }

  assertSameSite(existing.website, merged);

  if (targetsChanged) {
    await assertNoActiveConflict(
      existing.websiteId,
      { url: merged.controlUrl, match: merged.controlMatchType },
      experimentId,
    );
  }

  const { experimentId: _id, variantSplit: _split, ...data } = merged;
  const result = await experimentRepo.updateExperiment(experimentId, actorUserId, {
    ...data,
    description: data.description ?? null,
  });

  if (result.count === 0) {
    throw notFound("That experiment does not exist.");
  }

  return getExperiment(actorUserId, experimentId);
}

/** Moves an experiment through its lifecycle, stamping the start and stop timestamps. */
export async function changeStatus(actorUserId: string, input: unknown): Promise<Experiment> {
  const { experimentId, status } = parseOrThrow(changeExperimentStatusSchema, input);
  const existing = await getExperiment(actorUserId, experimentId);

  if (existing.status === status) {
    return existing;
  }

  if (!ALLOWED_TRANSITIONS[existing.status].includes(status)) {
    throw conflict(`An experiment cannot go from ${existing.status} to ${status}.`);
  }

  // Activation is the moment the conflict actually matters, so it is re-checked here even
  // though creation and editing already checked it — another experiment may have been
  // activated in between.
  if (status === "ACTIVE") {
    await assertNoActiveConflict(
      existing.websiteId,
      { url: existing.controlUrl, match: existing.controlMatchType },
      experimentId,
    );
  }

  await experimentRepo.updateExperiment(experimentId, actorUserId, {
    status,
    // publishedAt marks the first activation only, so a pause/resume cycle does not reset it.
    ...(status === "ACTIVE" && existing.publishedAt === null ? { publishedAt: new Date() } : {}),
    ...(status === "ARCHIVED" ? { stoppedAt: new Date() } : {}),
  });

  return getExperiment(actorUserId, experimentId);
}

export async function deleteExperiment(actorUserId: string, experimentId: string): Promise<void> {
  const result = await experimentRepo.deleteExperiment(experimentId, actorUserId);

  if (result.count === 0) {
    throw notFound("That experiment does not exist.");
  }
}

/** Status values an experiment may currently move to. Drives which controls the UI offers. */
export function allowedTransitions(status: ExperimentStatus): readonly ExperimentStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

/**
 * Public results sharing.
 *
 * A share link is an unguessable token, not an access grant: anyone holding it can read one
 * experiment's numbers and nothing else — no account, no website, no other experiment. That is
 * the whole security model, so the token has to be genuinely unguessable and revocation has to
 * be immediate.
 */

/** 192 bits from a CSPRNG. Long enough that enumeration is not a threat worth modelling. */
const SHARE_TOKEN_BYTES = 24;

function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

/**
 * Turns sharing on, or returns the existing link.
 *
 * Idempotent on purpose: clicking "share" twice should hand back the same URL rather than
 * quietly invalidating the one already sent to somebody.
 */
export async function enableSharing(
  actorUserId: string,
  experimentId: string,
): Promise<Experiment> {
  const existing = await getExperiment(actorUserId, experimentId);
  if (existing.shareToken) return existing;

  await experimentRepo.updateExperiment(experimentId, actorUserId, {
    shareToken: generateShareToken(),
    sharedAt: new Date(),
  });

  return getExperiment(actorUserId, experimentId);
}

/**
 * Issues a new token, invalidating the previous link immediately.
 *
 * Separate from disabling because they answer different questions: "this link got out" versus
 * "I no longer want this shared at all".
 */
export async function rotateShareToken(
  actorUserId: string,
  experimentId: string,
): Promise<Experiment> {
  await getExperiment(actorUserId, experimentId);

  await experimentRepo.updateExperiment(experimentId, actorUserId, {
    shareToken: generateShareToken(),
    sharedAt: new Date(),
  });

  return getExperiment(actorUserId, experimentId);
}

/** Turns sharing off. Clearing the token *is* the revocation — there is no second flag to miss. */
export async function disableSharing(
  actorUserId: string,
  experimentId: string,
): Promise<Experiment> {
  await getExperiment(actorUserId, experimentId);

  await experimentRepo.updateExperiment(experimentId, actorUserId, {
    shareToken: null,
    sharedAt: null,
  });

  return getExperiment(actorUserId, experimentId);
}

/**
 * Resolves a shared experiment from its token, for the public results page.
 *
 * Deliberately takes no actor: the token is the authorization. Returns null for an unknown or
 * revoked token, which the route renders as a plain 404 — telling a stranger the difference
 * between "never existed" and "was revoked" is information they have no need for.
 */
export function findSharedExperiment(
  shareToken: string,
): Promise<experimentRepo.ExperimentWithWebsite | null> {
  return experimentRepo.findExperimentByShareToken(shareToken);
}
