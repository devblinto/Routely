/**
 * Refuses to run a destructive database command against anything but a local database.
 *
 * `prisma migrate reset` drops every table and recreates them. That is exactly what you want
 * against a development database and never what you want anywhere else — and the two are told
 * apart by a single line in a file that is easy to edit and easy to forget. This repository's
 * `.env` did at one point point at the production Neon instance, which meant `npm run db:reset`
 * was aimed at production data with nothing in the way.
 *
 * The check is a host allow-list rather than a "does it look like Neon" deny-list: a new
 * provider, a new hostname or a tunnelled connection would all slip past a deny-list, and the
 * set of hosts that are genuinely safe to wipe is small and known.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, "../.env");

/** Hosts a developer may destroy. Anything else has to be done deliberately, by hand. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

function readDatabaseUrl() {
  // The running environment wins, so `DATABASE_URL=... npm run db:reset` is still checked.
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(ENV_PATH)) return undefined;

  // Last definition wins, matching dotenv — the behaviour that hid the duplicate in the first
  // place, so the guard has to read the file the same way rather than the way it looks.
  let found;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line);
    if (match) found = match[1].trim().replace(/^["']|["']$/g, "");
  }
  return found;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

const url = readDatabaseUrl();

if (!url) {
  console.error("\n  DATABASE_URL is not set — refusing to run a destructive command.\n");
  process.exit(1);
}

const host = hostOf(url);

if (!host || !LOCAL_HOSTS.has(host)) {
  console.error(
    [
      "",
      `  Refusing to run a destructive database command against "${host ?? "an unparseable URL"}".`,
      "",
      "  This command drops every table. It is allowed only against a local database",
      `  (${[...LOCAL_HOSTS].join(", ")}).`,
      "",
      "  If you meant to reset your local database, point DATABASE_URL in apps/web/.env at",
      "  the Docker Postgres from infra/docker-compose.dev.yml and start it with:",
      "",
      "      npm run db:up",
      "",
      "  Production migrations are applied by the Vercel build (`npm run vercel-build`),",
      "  never from a developer machine.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
