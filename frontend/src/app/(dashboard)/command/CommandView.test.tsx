import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/command" }));

vi.mock("@/components/map/client", () => ({
  BaseMapClient: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-stub">{children}</div>,
  ServiceAreaLayerClient: () => null,
  DtLayerClient: () => null,
  AssetLayerClient: () => null,
}));

import { ScopeProvider } from "@/lib/scope";
import { CommandView } from "./CommandView";

describe("CommandView (D1 Grid Command Centre)", () => {
  it("renders every section from the offline fixtures when the backend is unreachable", async () => {
    render(
      <ScopeProvider>
        <CommandView />
      </ScopeProvider>,
    );

    await waitFor(() => expect(screen.getAllByText("Krishna Nagar").length).toBeGreaterThan(0), { timeout: 25_000 });

    // Moneyshot headline (exactly one prominent number).
    expect(screen.getByText("Moneyshot")).toBeInTheDocument();

    // Situation banner picks the worst-risk sub-division.
    expect(screen.getByText(/Krishna Nagar sub-division at critical risk/)).toBeInTheDocument();

    // Map card + legend.
    expect(screen.getByTestId("map-stub")).toBeInTheDocument();

    // Sub-division league table.
    expect(screen.getByText(/Sub-division league table/)).toBeInTheDocument();

    // Heatmap + supply/demand chart.
    expect(screen.getByRole("group", { name: "Sub-division risk by hour" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Supply vs demand" })).toBeInTheDocument();

    // Pending plans, lever stack, critical loads.
    expect(screen.getByText(/Flex Plan.*awaiting approval/)).toBeInTheDocument();
    expect(screen.getByText(/Lever mix covering/)).toBeInTheDocument();
    expect(screen.getByText(/critical facilit(y|ies)/)).toBeInTheDocument();

    // Reliability gain + risk mix + event feed.
    expect(screen.getByText(/hours of help delivered/)).toBeInTheDocument();
    expect(screen.getByText(/Risk mix/)).toBeInTheDocument();
    expect(screen.getByText(/Live event feed/)).toBeInTheDocument();
  });
});
