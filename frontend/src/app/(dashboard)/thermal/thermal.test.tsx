import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { ThermalView } from "./ThermalView";
import { alarmCount, hourlyThermalTrace, moneyshotTitle, overloadedCount, tripRiskCount } from "./titles";
import type { Transformer } from "@/lib/api/types";

const dts: Transformer[] = [
  { id: "dt_1", feederId: "f1", subdivisionId: "sd_subhashnagar", name: "DT 1", ratingKva: 250, loadingPu: 0.8, hotspotC: 95, lossOfLifePct: 1, riskLevel: "low", riskIndex: 0.2, consumerCount: 100, servedFraction: 0.98, voltagePu: 1, location: { lat: 0, lng: 0 }, serviceAreaPolygon: [] },
  { id: "dt_2", feederId: "f1", subdivisionId: "sd_subhashnagar", name: "DT 2", ratingKva: 250, loadingPu: 1.35, hotspotC: 122, lossOfLifePct: 7, riskLevel: "critical", riskIndex: 0.95, consumerCount: 200, servedFraction: 0.8, voltagePu: 0.93, location: { lat: 0, lng: 0 }, serviceAreaPolygon: [] },
];

describe("titles.ts pure functions", () => {
  it("overloadedCount / alarmCount / tripRiskCount threshold correctly", () => {
    expect(overloadedCount(dts)).toBe(1);
    expect(alarmCount(dts)).toBe(1);
    expect(tripRiskCount(dts)).toBe(1);
  });

  it("moneyshotTitle names the trip count", () => {
    expect(moneyshotTitle(2)).toBe("2 DT trips avoided vs the shadow baseline today");
  });

  it("hourlyThermalTrace peaks around 19:00 and has 12 points", () => {
    const trace = hourlyThermalTrace(dts[1]);
    expect(trace).toHaveLength(12);
    const peak = trace.reduce((best, p) => (p.hotspotC > best.hotspotC ? p : best), trace[0]);
    expect(peak.x).toBe("19:00");
  });
});

describe("ThermalView", () => {
  it("renders the thermal trace and ageing table from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <ThermalView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Fleet loading heat (evening)")).toBeInTheDocument();
    expect(screen.getByText("Transformer Health")).toBeInTheDocument();
  });
});
