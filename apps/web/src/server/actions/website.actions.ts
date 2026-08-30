"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SiteProtocol } from "@/generated/prisma/enums";
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
      protocol: formData.get("protocol") ?? undefined,
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  // Outside runAction: redirect() signals by throwing, and must reach Next.js uncaught.
  redirect(routes.websites.detail(result.data.id));
}

export interface CreateWebsiteInlineState extends FormState {
  /** Present on success, for a caller that needs the created row without navigating away. */
  website?: { id: string; name: string; domain: string; protocol: SiteProtocol };
}

/**
 * Same creation as `createWebsiteAction`, for a caller that can't navigate away — the
 * experiment wizard's "Add another website" dialog, which needs to select the new website and
 * keep going rather than leaving the flow it was opened from.
 */
export async function createWebsiteInlineAction(
  _previous: CreateWebsiteInlineState,
  formData: FormData,
): Promise<CreateWebsiteInlineState> {
  const user = await requireUser();

  const result = await runAction(() =>
    websiteService.createWebsite(user.id, {
      name: formData.get("name"),
      domain: formData.get("domain"),
      // Absent means "not specified", which the schema turns into the https default. A null
      // from `formData.get` would fail the enum instead of taking that default.
      protocol: formData.get("protocol") ?? undefined,
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  return {
    status: "success",
    website: {
      id: result.data.id,
      name: result.data.name,
      domain: result.data.domain,
      protocol: result.data.protocol,
    },
  };
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
      protocol: formData.get("protocol") ?? undefined,
    }),
  );

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.websites.detail(websiteId));

  return { status: "success", message: "Website updated." };
}

/**
 * Deletes every selected website.
 *
 * Ids arrive as repeated `websiteId` fields, and ownership is enforced inside the delete's own
 * where clause — so an id belonging to someone else contributes nothing rather than erroring,
 * and the count that comes back reflects only what the actor actually owned.
 *
 * Stays on the page rather than redirecting: the table it was triggered from is still the right
 * place to be afterwards.
 */
export async function deleteWebsitesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const websiteIds = formData.getAll("websiteId").map(String).filter(Boolean);

  if (websiteIds.length === 0) {
    return { status: "error", message: "Select at least one website to delete." };
  }

  const result = await runAction(() => websiteService.deleteWebsites(user.id, websiteIds));

  if (!result.ok) {
    return result.state;
  }

  revalidatePath(routes.getStarted);

  return {
    status: "success",
    message: `Deleted ${result.data} website${result.data === 1 ? "" : "s"}.`,
  };
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

  redirect(routes.experiments.list);
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
