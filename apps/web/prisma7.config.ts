import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration — migrations, introspection, studio.
 *
 * The URL here is the CLI's, and it is deliberately *not* the one the running app uses.
 * `DATABASE_URL` may point at a transaction pooler (Neon's `-pooler` host, Supabase's 6543),
 * which multiplexes connections and cannot hold the session-level advisory locks or run the
 * DDL that `prisma migrate` needs. `DIRECT_DATABASE_URL` is the unpooled endpoint for exactly
 * this purpose; when it is absent — a plain Postgres, as in local development — the two are
 * the same thing and `DATABASE_URL` is used.
 *
 * The runtime client is configured separately in `src/server/db.ts`, and always uses the
 * pooled URL.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_DATABASE_URL"] || process.env["DATABASE_URL"],
  },
});
