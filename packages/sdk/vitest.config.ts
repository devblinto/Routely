import { defineConfig } from "vitest/config";

/**
 * The SDK's tests run in plain Node with no DOM.
 *
 * That is possible because the browser-dependent parts are reached through injectable
 * interfaces — `resolveIdentity` takes its stores, the cache takes a `KeyValueStore` — so the
 * logic worth testing is pure. It keeps the test run fast and avoids a jsdom dependency in a
 * package whose entire point is having no dependencies.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
