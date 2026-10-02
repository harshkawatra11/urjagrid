import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { ChargersView } from "./ChargersView";
import { fleetTitle, kwRecovered, moneyshotTitle, statusCounts } from "./titles";
import type { ChargerStatus } from "@/lib/api/types";

const chargers: ChargerStatus[] = [
  { id: "chg_1", dtId: "dt_sn_01", subdivisionId: "sd_subhashnagar", name: "Hub 1", kind: "e_rickshaw", status: "curtailed", curtailmentFraction: 0.4, powerKw: 9.6, ratedKw: 16 },
  { id: "chg_2", dtId: "dt_sn_02", subdivisionId: "sd_subhashnagar", name: "Hub 2", kind: "ev", status: "charging", curtailmentFraction: 0, powerKw: 22, ratedKw: 22 },
];

describe("titles.ts pure functions", () => {
  it("fleetTitle counts chargers", () => {
    expect(fleetTitle(2)).toBe("2 chargers under OCPP SetChargingProfile control");
  });

  it("statusCounts tallies every status", () => {
    expect(statusCounts(chargers)).toEqual({ online: 0, charging: 1, curtailed: 1, offline: 0 });
  });

  it("kwRecovered sums curtailmentFraction * ratedKw", () => {
    expect(kwRecovered(chargers)).toBeCloseTo(6.4, 5);
  });

  it("moneyshotTitle formats the average curtailment", () => {
    expect(moneyshotTitle(40)).toBe("40% average curtailment across the charger fleet");
  });
});

describe("ChargersView", () => {
  it("renders the fleet table and heatmap from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <ChargersView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Evening-peak curtailment pattern")).toBeInTheDocument();
    expect(screen.getByText("Managed Charging")).toBeInTheDocument();
  });
});
