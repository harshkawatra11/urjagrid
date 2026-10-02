import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/flex" }));

vi.mock("@/components/map/client", () => ({
  BaseMapClient: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-stub">{children}</div>,
  ServiceAreaLayerClient: () => null,
  DtLayerClient: () => null,
  AssetLayerClient: () => null,
}));

import { ScopeProvider } from "@/lib/scope";
import { FlexView } from "./FlexView";

describe("FlexView (D11 Live Grid Ops)", () => {
  it("renders sub-division strips, the map, meter counters, lever stack, active plans, live feed and history", async () => {
    render(
      <ScopeProvider>
        <FlexView />
      </ScopeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("map-stub")).toBeInTheDocument(), { timeout: 25_000 });

    expect(screen.getByText(/sub-divisions/)).toBeInTheDocument();
    expect(screen.getByText(/Meter states across/)).toBeInTheDocument();
    expect(screen.getByText(/Lever mix across active plans/)).toBeInTheDocument();
    expect(screen.getAllByText(/active plan/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Live command feed/)).toBeInTheDocument();
    expect(screen.getByText(/Event history/)).toBeInTheDocument();
  });
});
