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
    // worker at once: observed symptoms ranged from 100s+ of pure transform/setup overhead to
    // components silently failing to reach their loaded render (likely React 19 unmounting on an
    // error from a starved/delayed microtask queue racing the mocked-fetch resolution), both of
    // which went away running files one at a time. The fetch mock above keeps each individual
    // file fast, so serializing is a small cost for a suite that is otherwise flaky.
    fileParallelism: false,
  },
});
