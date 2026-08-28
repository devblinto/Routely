import type { DefaultSession } from "next-auth";

/**
 * Auth.js type augmentation.
 *
 * The default `Session["user"]` carries only name, email and image. The `session` callback in
 * `src/server/auth/config.ts` copies the adapter user's id onto it, and this declaration is
 * what makes that visible to TypeScript — without it every consumer would need a cast.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export {};
