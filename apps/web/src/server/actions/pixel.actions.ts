"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/lib/routes";
import { type FormState, runAction } from "@/server/actions/types";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

/**
 * Server Action for the Get started guide's "Verify installation" step.
 *
 * There is nothing to fetch from the visitor's site here — detection is derived from whether
 * the ingestion endpoint has ever recorded an event for this website, so verifying is just
 * asking that question again. A "not detected yet" result is a normal outcome, not an error:
 * the snippet may just not have been visited yet.
 */
export async function verifyPixelAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const websiteId = String(formData.get("websiteId") ?? "");

  const result = await runAction(() => websiteService.isPixelDetected(user.id, websiteId));

  if (!result.ok) {
    return result.state;
  }

  if (!result.data) {
    return {
      status: "error",
      message:
        "We haven't received any data yet. Make sure the snippet is installed, then visit your site once and try again.",
    };
  }

  revalidatePath(routes.getStarted);
  revalidatePath(routes.dashboard);

  return { status: "success", message: "Pixel detected." };
}
