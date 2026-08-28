"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";
import { type FormState, runAction } from "@/server/actions/types";
import { requireUser } from "@/server/auth/session";
import * as experimentService from "@/server/services/experiment.service";

/** Server Actions for the public results link. Ownership comes from the session, as always. */

async function withExperiment(
  formData: FormData,
  operation: (userId: string, experimentId: string) => Promise<unknown>,
  message: string,
): Promise<FormState> {
  const user = await requireUser();
  const experimentId = String(formData.get("experimentId") ?? "");

  const result = await runAction(() => operation(user.id, experimentId));
  if (!result.ok) return result.state;

  revalidatePath(routes.experiments.detail(experimentId));
  return { status: "success", message };
}

export async function enableSharingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return withExperiment(formData, experimentService.enableSharing, "Share link created.");
}

export async function rotateShareTokenAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return withExperiment(
    formData,
    experimentService.rotateShareToken,
    "New link created. The previous one no longer works.",
  );
}

export async function disableSharingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return withExperiment(
    formData,
    experimentService.disableSharing,
    "Sharing turned off. The link no longer works.",
  );
}
