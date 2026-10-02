import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/reliability" }));

import { ScopeProvider } from "@/lib/scope";
import { ReliabilityView } from "./ReliabilityView";

describe("ReliabilityView (D17 Reliability)", () => {
  it("renders the 6-tile comparison band, the trend chart and the CEEW calibration matrix", async () => {
    render(
      <ScopeProvider>
        <ReliabilityView />
      </ScopeProvider>,
    );

    await waitFor(() => expect(screen.getByRole("group", { name: "Supply vs demand" })).toBeInTheDocument(), {
      timeout: 25_000,
    });

    expect(screen.getByText(/hours of help delivered/)).toBeInTheDocument();
    expect(screen.getAllByText(/SAIDI/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SAIFI/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lifeline availability/)).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Firm-share calibration matrix" })).toBeInTheDocument();
    expect(screen.getByText("Urban")).toBeInTheDocument();
    expect(screen.getByText("Rural")).toBeInTheDocument();
  });
});
