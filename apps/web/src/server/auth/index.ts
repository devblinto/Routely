import "server-only";

import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/config";

/**
 * The initialised Auth.js instance.
 *
 * `handlers` is mounted at /api/auth/[...nextauth]; `auth()` resolves the current session and
 * is consumed only through `src/server/auth/session.ts`, which is the seam the rest of the
 * application depends on.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
