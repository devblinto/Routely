import { handlers } from "@/server/auth";

/**
 * Auth.js endpoints: sign-in, the Google OAuth callback, sign-out, session and CSRF.
 *
 * The Prisma adapter uses a Node database driver, so this route must run on the Node.js
 * runtime rather than the Edge runtime.
 */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
