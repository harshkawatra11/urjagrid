import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { PowerQualityView } from "./PowerQualityView";
import { lossBreakdown, moneyshotTitle, technicalLossKw, voltageViolations } from "./titles";
import type { Transformer } from "@/lib/api/types";

const base: Transformer = {
  id: "dt_1",
  feederId: "f1",
  subdivisionId: "sd_subhashnagar",
  name: "DT 1",
  ratingKva: 250,
  loadingPu: 1.2,
  hotspotC: 100,
  lossOfLifePct: 2,
  riskLevel: "high",
  riskIndex: 0.7,
  consumerCount: 150,
  servedFraction: 0.9,
  voltagePu: 0.91,
  location: { lat: 0, lng: 0 },
  serviceAreaPolygon: [],
};

describe("titles.ts pure functions", () => {
  it("voltageViolations flags DTs outside the 0.94-1.06pu band", () => {
    expect(voltageViolations([base])).toHaveLength(1);
    expect(voltageViolations([{ ...base, voltagePu: 1.0 }])).toHaveLength(0);
  });

  it("technicalLossKw scales with loadingPu squared", () => {
    const low = technicalLossKw({ ...base, loadingPu: 1 });
    const high = technicalLossKw({ ...base, loadingPu: 2 });
    expect(high).toBeCloseTo(low * 4, 5);
  });

  it("lossBreakdown splits into three segments summing to the total", () => {
    const breakdown = lossBreakdown([base]);
    const total = breakdown.reduce((s, b) => s + b.lossKw, 0);
    expect(breakdown).toHaveLength(3);
    expect(total).toBeCloseTo(technicalLossKw(base), 5);
  });

  it("moneyshotTitle counts violations", () => {
    expect(moneyshotTitle(3)).toBe("3 transformers outside the 0.94–1.06pu voltage band");
  });
});

describe("PowerQualityView", () => {
  it("renders the voltage profile and loss breakdown from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <PowerQualityView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Voltage & Losses")).toBeInTheDocument();
    expect(await screen.findByText("Voltage heat matrix")).toBeInTheDocument();
  });
});
