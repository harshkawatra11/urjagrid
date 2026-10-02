import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * No test environment has a real UrjaGrid backend behind it, so every `fetch` the data layer
 * (`lib/api/base.ts` -> `useApi`) makes would otherwise hit a real connection-refused round trip
 * against `127.0.0.1:8080` before falling back to the committed fixture. That is slow and, under
 * the full suite's test-file parallelism, was observed to exhaust the loopback socket table and
 * crash a worker. Failing fast here makes every page's offline-fixture path deterministic and
 * instant without changing what any page renders (SPEC: "must work offline ... with offline
 * banner" is exactly this path).
 */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new TypeError("fetch failed (no backend in the test environment)"))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
