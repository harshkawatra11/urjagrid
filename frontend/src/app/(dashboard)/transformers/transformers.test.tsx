import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { TransformersView } from "./TransformersView";
import { dominantDriver, lensValue, moneyshotTitle } from "./titles";
import type { Transformer } from "@/lib/api/types";

const dt: Transformer = {
  id: "dt_kn_01",
  feederId: "fdr_kn_a",
  subdivisionId: "sd_krishnanagar",
  name: "Krishna Nagar DT 01",
  ratingKva: 315,
  loadingPu: 1.34,
  hotspotC: 121.8,
  lossOfLifePct: 6.8,
  riskLevel: "critical",
  riskIndex: 0.95,
  consumerCount: 268,
  servedFraction: 0.79,
  voltagePu: 0.93,
  location: { lat: 27.4927, lng: 77.6741 },
  serviceAreaPolygon: [],
};

describe("titles.ts pure functions", () => {
  it("lensValue reads the right field per lens", () => {
    expect(lensValue(dt, "risk")).toBe(0.95);
    expect(lensValue(dt, "loading")).toBe(1.34);
    expect(lensValue(dt, "hotspot")).toBe(121.8);
    expect(lensValue(dt, "voltage")).toBe(0.93);
    expect(lensValue(dt, "served")).toBe(0.79);
  });

  it("dominantDriver picks the largest normalized deviation (voltage, for this sample DT)", () => {
    expect(dominantDriver(dt)).toBe("voltage");
  });

  it("moneyshotTitle names the worst DT", () => {
    expect(moneyshotTitle(dt)).toContain("Krishna Nagar DT 01");
  });

  it("moneyshotTitle handles the empty case", () => {
    expect(moneyshotTitle(undefined)).toBe("No transformer data available");
  });
});

describe("TransformersView", () => {
  it("renders the tile grid and ranked table, and switches lens", async () => {
    render(
      <ScopeProvider>
        <TransformersView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Transformers")).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Transformer tile grid" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hot-spot" }));
    expect(screen.getAllByText(/°C/).length).toBeGreaterThan(0);
  });
});
