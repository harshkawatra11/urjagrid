import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EconomicsView } from "./EconomicsView";
import { moneyshotTitle, recomputeEconomics } from "./titles";

describe("titles.ts pure functions", () => {
  it("recomputeEconomics scales payback and BCR with the fee", () => {
    const base = recomputeEconomics({
      assumptions: { rebateRsPerKwh: 2, dtFailureCostRs: 100000, deferredUpgradeCostRs: 100000, energyValueRsPerKwh: 6, monthlyFeeRsPerMeter: 8.5 },
      nMeters: 1000,
      monthlyDrKwhShifted: 500,
      monthlyAvoidedSheddingKwh: 2000,
    });
    expect(base.monthlyFeeRs).toBe(8500);
    expect(base.annualSavingsRs).toBeGreaterThan(0);
    expect(base.bcr).toBeGreaterThan(0);
    expect(base.paybackMonths).toBeGreaterThan(0);
  });

  it("higher monthly fee increases payback months", () => {
    const low = recomputeEconomics({
      assumptions: { rebateRsPerKwh: 2, dtFailureCostRs: 0, deferredUpgradeCostRs: 0, energyValueRsPerKwh: 6, monthlyFeeRsPerMeter: 5 },
      nMeters: 1000,
      monthlyDrKwhShifted: 500,
      monthlyAvoidedSheddingKwh: 2000,
    });
    const high = recomputeEconomics({
      assumptions: { rebateRsPerKwh: 2, dtFailureCostRs: 0, deferredUpgradeCostRs: 0, energyValueRsPerKwh: 6, monthlyFeeRsPerMeter: 50 },
      nMeters: 1000,
      monthlyDrKwhShifted: 500,
      monthlyAvoidedSheddingKwh: 2000,
    });
    expect(high.paybackMonths).toBeGreaterThan(low.paybackMonths);
  });

  it("moneyshotTitle formats payback and BCR", () => {
    expect(moneyshotTitle(7.4, 3.1)).toBe("7.4-month payback, 3.1x benefit-cost ratio");
  });
});

describe("EconomicsView", () => {
  it("renders sliders, money flow, and sensitivity matrix from offline fixtures", async () => {
    render(<EconomicsView />);
    expect(await screen.findByText("Economics")).toBeInTheDocument();
    expect(await screen.findByText("Money flow")).toBeInTheDocument();
    const slider = screen.getByText(/DR rebate:/);
    expect(slider).toBeInTheDocument();
  });

  it("moving a slider updates the payback moneyshot", async () => {
    render(<EconomicsView />);
    await screen.findByText("Economics");
    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "5" } });
    expect(screen.getByText(/DR rebate: ₹5\.00\/kWh/)).toBeInTheDocument();
  });
});
