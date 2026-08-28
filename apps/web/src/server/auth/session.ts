import "server-only";

import { redirect } from "next/navigation";

import { env } from "@/env";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";
import { unauthenticated } from "@/server/errors";
import { auth } from "@/server/auth";

/**
 * The session seam.
 *
 * Every protected page, Server Action and route handler resolves the current user through
 * this module and nothing else, so the rest of the codebase never imports Auth.js directly.
 *
 * `auth()` reads the session cookie and, under the database strategy, loads the session row
 * from Postgres. Reading the request that way is also what marks every protected route as
 * dynamically rendered — without it Next.js would try to prerender per-user pages at build
 * time, where no session exists.
 */

export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface Session {
  user: SessionUser;
}

/**
 * Development-only placeholder identity, used when `AUTH_DEV_BYPASS` is set so the dashboard
 * can be worked on without Google credentials. `src/env.ts` forces the flag off whenever
 * NODE_ENV is "production", so this can never grant access to a deployed instance.
 */
const DEV_USER_EMAIL = "dev@routely.local";

/**
 * Resolves the bypass identity to a **real** `users` row.
 *
 * The row has to exist: websites and experiments are foreign-keyed to a user, so a fabricated
 * id would let the dashboard render and then fail on the first write. The promise is cached
 * at module scope so this costs one query per server process rather than one per request.
 */
let devUser: Promise<SessionUser> | null = null;

function resolveDevUser(): Promise<SessionUser> {
  devUser ??= db.user
    .upsert({
      where: { email: DEV_USER_EMAIL },
      create: { email: DEV_USER_EMAIL, name: "Local Developer" },
      update: {},
    })
    .then((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    }))
    .catch((error) => {
      // Do not cache a failure — the database may simply not be running yet.
      devUser = null;
      throw error;
    });

  return devUser;
}

/** Returns the current session, or `null` when the request is anonymous. */
export async function getSession(): Promise<Session | null> {
  if (env.AUTH_DEV_BYPASS) {
    return { user: await resolveDevUser() };
  }

  const session = await auth();

  // A session row can outlive its user — `email` is non-nullable in the schema, but the
  // Auth.js Session type allows it to be absent, so an incomplete session is treated as no
  // session rather than being coerced into a half-populated user.
  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email,
      image: session.user.image ?? null,
    },
  };
}

/**
 * Session accessor for pages and layouts: redirects anonymous visitors to the login screen,
 * preserving where they were headed so they can be returned there after signing in.
 */
export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession();

  if (!session) {
    const target = returnTo
      ? `${routes.login}?callbackUrl=${encodeURIComponent(returnTo)}`
      : routes.login;
    redirect(target);
  }

  return session;
}

/**
 * Session accessor for Server Actions and route handlers, where a redirect is the wrong
 * response and the caller needs a catchable error instead.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    throw unauthenticated();
  }

  return session.user;
}

/** True when Google sign-in is configured. Drives the login screen's fallback messaging. */
export function isAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.AUTH_SECRET);
}
