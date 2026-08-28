import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The single Prisma client for the process.
 *
 * Prisma 7 connects through a driver adapter rather than a bundled query engine, so the
 * Postgres pool is configured here and owned by this module alone.
 *
 * Next.js hot-reloads server modules on every edit in development, so constructing the client
 * at module scope would leak a new connection pool per reload until Postgres refuses further
 * connections. Caching it on `globalThis` — which survives module reloads — avoids that; in
 * production the module is evaluated once and the cache is never read.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export { Prisma } from "@/generated/prisma/client";
export type { PrismaClient } from "@/generated/prisma/client";

/**
 * A Prisma client *or* an interactive transaction handle. Repository functions accept this so
 * a caller can compose several writes into one transaction without the repository knowing
 * which of the two it received.
 */
export type DbClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$transaction" | "$extends">;
