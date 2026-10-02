import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
    // `fetch` is stubbed to fail fast in src/test/setup.ts, so this only needs headroom for
    // slower CI machines, not for a real network round trip.
    testTimeout: 20000,
    // This machine's CPU/IO starves badly when every one of the ~28 test files gets its own
    // worker at once (observed: 100s+ just in transform/setup before any test runs, then
    // individually-fast tests time out waiting for a starved event loop). Capping workers keeps
    // each file's own timers and fetch-mock promises responsive.
    maxWorkers: 4,
  },
});
