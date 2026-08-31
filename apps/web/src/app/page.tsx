import { redirect } from "next/navigation";

import { AFTER_SIGN_IN, routes } from "@/lib/routes";
import { getSession } from "@/server/auth/session";

/**
 * The root path is a router, not a page: signed-in users go to their experiments, everyone else
 * to the login screen. A marketing landing page is out of scope for the MVP.
 */
export default async function HomePage() {
  const session = await getSession();
  redirect(session ? AFTER_SIGN_IN : routes.login);
}
