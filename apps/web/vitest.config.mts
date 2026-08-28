import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit tests for pure server-side logic — rate limiting, bot filtering, URL matching.
 *
 * Route handlers and services are covered by the end-to-end verification against a running
 * server and a real database instead, because what matters about them is precisely the
 * behaviour a mock would have to invent.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws on import outside a React Server Component bundler, which is
      // exactly its job. Under test it is redirected to the no-op the package already ships
      // for the `react-server` condition, so importing a server module is possible without
      // weakening the guard in the application build.
      "server-only": path.resolve(import.meta.dirname, "../../node_modules/server-only/empty.js"),
    },
  },
});
