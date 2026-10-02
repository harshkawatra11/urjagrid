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
    // Lane D page tests render against real SWR hooks; the first render fails fast against the
    // (absent, in CI) backend and falls back to committed fixtures, which needs a bit more than
    // the 5s default across several hooks per page.
    testTimeout: 60_000,
  },
});
