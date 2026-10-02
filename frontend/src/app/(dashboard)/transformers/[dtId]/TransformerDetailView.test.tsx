import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/transformers/dt_sn_01",
  useParams: () => ({ dtId: "dt_sn_01" }),
}));

import { ScopeProvider } from "@/lib/scope";
import { TransformerDetailView } from "./TransformerDetailView";

describe("TransformerDetailView (D8 Transformer case file)", () => {
  it("renders forecast, gauges, meter wall, single-line diagram, thermal trace and risk drivers from fixtures", async () => {
    render(
      <ScopeProvider>
        <TransformerDetailView />
      </ScopeProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByRole("group", { name: "Forecast fan chart" })).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "Meter wall" })).toBeInTheDocument();
      },
      { timeout: 45_000 },
    );

    expect(screen.getAllByText(/Subhash Nagar DT 01/).length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: "DT loading" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Hot-spot temperature" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Single line diagram" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Transformer thermal trace" })).toBeInTheDocument();
    expect(screen.getByText(/risk driver/)).toBeInTheDocument();
    expect(screen.getByText(/Who's here/)).toBeInTheDocument();
  });
});
