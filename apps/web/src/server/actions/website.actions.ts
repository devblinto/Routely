"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { type FormState, runAction } from "@/server/actions/types";
import { requireUser } from "@/server/auth/session";
import * as websiteService from "@/server/services/website.service";

/**
 * Server Actions for website management.
 *
 * Each one re-establishes the actor from the session rather than trusting anything in the
 * submitted form: a Server Action is a public HTTP endpoint, and a `userId` arriving in a
 * form field would be attacker-supplied. The service layer then scopes every query by that
 * actor, so an id belonging to someone else resolves to "not found".
 */

export async function createWebsiteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const result = await runAction(() =>
    websiteService.createWebsite(user.id, {
      name: formData.get("name"),
      domain: formData.get("domain"),
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  // Outside runAction: redirect() signals by throwing, and must reach Next.js uncaught.
  revalidatePath(routes.dashboard);
  redirect(routes.websites.detail(result.data.id));
}

export async function updateWebsiteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const websiteId = String(formData.get("websiteId") ?? "");

  const result = await runAction(() =>
    websiteService.updateWebsite(user.id, {
      websiteId,
      name: formData.get("name"),
      domain: formData.get("domain"),
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.dashboard);
  revalidatePath(routes.websites.detail(websiteId));

  return { status: "success", message: "Website updated." };
}

export async function deleteWebsiteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const websiteId = String(formData.get("websiteId") ?? "");

  const result = await runAction(() => websiteService.deleteWebsite(user.id, websiteId));

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.dashboard);
  redirect(routes.dashboard);
}

/**
 * Issues a new public site id. Separated from `updateWebsiteAction` because it breaks every
 * installed snippet for the website — that is a decision, not an edit.
 */
export async function regenerateSiteIdAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const websiteId = String(formData.get("websiteId") ?? "");

  const result = await runAction(() => websiteService.rotatePublicSiteId(user.id, websiteId));

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.websites.detail(websiteId));

  return {
    status: "success",
    message: "New public site id issued. Update the snippet on your website.",
  };
}
