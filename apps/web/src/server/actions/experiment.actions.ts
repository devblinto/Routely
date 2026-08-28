"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { type FormState, runAction } from "@/server/actions/types";
import { requireUser } from "@/server/auth/session";
import * as experimentService from "@/server/services/experiment.service";

/**
 * Server Actions for experiment management.
 *
 * As with websites, the actor comes from the session and never from the submitted form — a
 * Server Action is a public HTTP endpoint, so any id in the body is attacker-supplied. The
 * service scopes every query through the parent website's owner, so an experiment or website
 * belonging to someone else resolves to "not found".
 */

/** Reads an optional text field, treating an empty submission as absent rather than as "". */
function optionalText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createExperimentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const result = await runAction(() =>
    experimentService.createExperiment(user.id, {
      websiteId: formData.get("websiteId"),
      name: formData.get("name"),
      description: optionalText(formData, "description"),
      controlUrl: formData.get("controlUrl"),
      variantUrl: formData.get("variantUrl"),
      conversionUrl: formData.get("conversionUrl"),
      // Match types and the traffic split are not part of the MVP form. The service pins the
      // split at 50 regardless, and the schema defaults both match types to EXACT.
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  // Outside runAction: redirect() signals by throwing, and must reach Next.js uncaught.
  revalidatePath(routes.websites.detail(result.data.websiteId));
  redirect(routes.experiments.detail(result.data.id));
}

export async function updateExperimentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const experimentId = String(formData.get("experimentId") ?? "");

  const result = await runAction(() =>
    experimentService.updateExperiment(user.id, experimentId, {
      name: formData.get("name"),
      description: optionalText(formData, "description"),
      controlUrl: formData.get("controlUrl"),
      variantUrl: formData.get("variantUrl"),
      conversionUrl: formData.get("conversionUrl"),
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.experiments.detail(experimentId));
  revalidatePath(routes.websites.detail(result.data.websiteId));

  return { status: "success", message: "Experiment updated." };
}

export async function changeExperimentStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const experimentId = String(formData.get("experimentId") ?? "");

  const result = await runAction(() =>
    experimentService.changeStatus(user.id, {
      experimentId,
      status: formData.get("status"),
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.experiments.detail(experimentId));
  revalidatePath(routes.websites.detail(result.data.websiteId));

  return { status: "success" };
}

export async function deleteExperimentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const experimentId = String(formData.get("experimentId") ?? "");
  const websiteId = String(formData.get("websiteId") ?? "");

  const result = await runAction(() => experimentService.deleteExperiment(user.id, experimentId));

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.websites.detail(websiteId));
  redirect(websiteId ? routes.websites.detail(websiteId) : routes.dashboard);
}
