import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FanChart } from "./FanChart";
import { SupplyDemandChart } from "./SupplyDemandChart";
import { LeverWaterfall } from "./LeverWaterfall";
import { LorenzCurve } from "./LorenzCurve";
import { GaugeArc } from "./GaugeArc";
import { HourHeatmap } from "./HourHeatmap";
import { CompareBars } from "./CompareBars";
import { ThermalTrace } from "./ThermalTrace";
import { StepLine } from "./StepLine";
import { ChartTooltip } from "./ChartTooltip";
import { ChartLegend, seriesColor } from "./common";

describe("chart components render with sample data", () => {
  it("FanChart", () => {
    render(
      <FanChart
        data={[
          { x: "18:00", p10: 40, p50: 60, p90: 90, actual: 58 },
          { x: "18:15", p10: 42, p50: 62, p90: 92, actual: null },
        ]}
        limitKw={100}
      />,
    );
    expect(screen.getByRole("group", { name: "Forecast fan chart" })).toBeInTheDocument();
  });

  it("SupplyDemandChart", () => {
    render(
      <SupplyDemandChart
        data={[
          { x: "18:00", demandKw: 120, availableKw: 95 },
          { x: "18:15", demandKw: 130, availableKw: 90 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Supply vs demand" })).toBeInTheDocument();
  });

  it("LeverWaterfall", () => {
    render(
      <LeverWaterfall
        bars={[
          { lever: "behavioral_dr", reliefKw: 22 },
          { lever: "managed_charging", reliefKw: 18 },
          { lever: "lifeline_cap", reliefKw: 30 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Lever relief waterfall" })).toBeInTheDocument();
  });

  it("LorenzCurve", () => {
    render(
      <LorenzCurve
        points={[
          { cumulativePopulationPct: 0, cumulativeServedPct: 0 },
          { cumulativePopulationPct: 50, cumulativeServedPct: 40 },
          { cumulativePopulationPct: 100, cumulativeServedPct: 100 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Fairness Lorenz curve" })).toBeInTheDocument();
  });

  it("GaugeArc", () => {
    render(<GaugeArc value={1.18} max={1.3} valueLabel="1.18 pu" />);
    expect(screen.getByText("1.18 pu")).toBeInTheDocument();
  });

  it("HourHeatmap", () => {
    render(
      <HourHeatmap
        rows={["Subhash Nagar", "Krishna Nagar"]}
        cells={[
          { row: "Subhash Nagar", hour: 18, value: 0.4 },
          { row: "Krishna Nagar", hour: 18, value: 0.9 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Hourly heatmap" })).toBeInTheDocument();
  });

  it("CompareBars", () => {
    render(
      <CompareBars
        rows={[
          { label: "Served kWh", solution: 920, baseline: 810 },
          { label: "Unserved kWh", solution: 20, baseline: 130 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Solution vs baseline" })).toBeInTheDocument();
  });

  it("ThermalTrace", () => {
    render(
      <ThermalTrace
        data={[
          { x: "18:00", hotspotC: 95, loadingPu: 1.0 },
          { x: "18:15", hotspotC: 104, loadingPu: 1.18 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Transformer thermal trace" })).toBeInTheDocument();
  });

  it("StepLine", () => {
    render(
      <StepLine
        data={[
          { x: "18:00", value: 0 },
          { x: "18:15", value: 2 },
          { x: "18:30", value: 3 },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Step chart" })).toBeInTheDocument();
  });

  it("ChartTooltip renders nothing when inactive", () => {
    const { container } = render(<ChartTooltip active={false} payload={[{ name: "A", value: 1 }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ChartTooltip renders label, name and formatted value", () => {
    render(<ChartTooltip active label="18:00" unit="kW" payload={[{ name: "Demand", value: 123456, color: "var(--series-1)" }]} />);
    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(screen.getByText("Demand")).toBeInTheDocument();
    expect(screen.getByText(/1,23,456/)).toBeInTheDocument();
  });

  it("seriesColor wraps and ChartLegend hides for a single item", () => {
    expect(seriesColor(0)).toBe("var(--series-1)");
    expect(seriesColor(6)).toBe("var(--series-1)");
    const { container } = render(<ChartLegend items={[{ label: "A", color: "var(--series-1)" }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
