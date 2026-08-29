import "server-only";

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "@/env";
import { routes } from "@/lib/routes";
import { db } from "@/server/db";

/**
 * Auth.js configuration.
 *
 * Kept separate from `index.ts` so the options can be read and reasoned about without
 * importing the initialised singleton, and so tests can assert on the config directly.
 */

/**
 * Sessions are stored in Postgres (the `sessions` table), not in a JWT.
 *
 * The trade-off is one database read per request, in exchange for sessions that can be
 * revoked server-side: signing out — or deleting a user — invalidates the session
 * immediately, whereas a signed JWT stays valid until it expires no matter what the server
 * does. For a dashboard that already queries the database on every page, that read is free.
 */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const authConfig: NextAuthConfig = {
  // The adapter's types are written against the `@prisma/client` package, while this project
  // generates its client into src/generated/prisma. The runtime shape is identical — the
  // adapter only calls model methods — so the structural mismatch is narrowed here rather
  // than being allowed to leak into every call site.
  adapter: PrismaAdapter(db as never),

  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Refresh the expiry at most once a day rather than on every request, so a browsing
    // session does not generate a write per page view.
    updateAge: 24 * 60 * 60,
  },

  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Deliberately left at its default (false): enabling it would link a Google account to
      // an existing user purely because the email matches, which lets anyone who can obtain
      // a Google account for that address take over the existing one.
      allowDangerousEmailAccountLinking: false,
    }),
  ],

  pages: {
    signIn: routes.login,
    // Auth.js renders its own error page by default. Routing errors back to the login screen
    // keeps the user in one place; the reason arrives as `?error=`.
    error: routes.login,
  },

  /**
   * Required behind the Nginx reverse proxy, where the request Host is set by
   * `X-Forwarded-Host`. On its own this would allow host-header injection into callback
   * URLs, so `src/env.ts` requires `AUTH_URL` in production: with an explicit canonical
   * origin configured, Auth.js builds callbacks from it rather than from the request.
   */
  trustHost: true,

  callbacks: {
    /**
     * The database strategy hands the adapter's user record to this callback. The default
     * session shape omits the id, and every service call needs it, so it is copied across
     * once here instead of being re-fetched by each caller.
     */
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },

    /**
     * Open-redirect guard for `callbackUrl`. Auth.js already restricts redirects to the
     * configured origin; this narrows it further to same-origin absolute URLs and relative
     * paths, and refuses protocol-relative URLs like `//evil.example` that a naive
     * `startsWith("/")` check would let through.
     */
    redirect({ url, baseUrl }) {
      if (url.startsWith("/") && !url.startsWith("//")) {
        return `${baseUrl}${url}`;
      }

      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch {
        // Fall through to the safe default.
      }

      return `${baseUrl}${routes.experiments.list}`;
    },
  },

  events: {
    /**
     * The adapter creates the `users` row on first sign-in; this records that it happened.
     * Useful when diagnosing "why do I have two accounts" reports, which are almost always a
     * second identity provider rather than a duplicate row.
     */
    createUser({ user }) {
      console.info("[routely] created user profile", { userId: user.id });
    },
  },

  debug: env.NODE_ENV === "development",
};
