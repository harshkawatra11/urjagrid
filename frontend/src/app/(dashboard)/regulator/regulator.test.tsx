import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleProvider } from "@/lib/roleContext";
import { RegulatorView } from "./RegulatorView";
import { canDrillDown, moneyshotTitle, totalConsumers } from "./titles";
import type { FederationNode } from "@/lib/api/types";

const nodes: FederationNode[] = [
  { discom: "MVVNL", town: "Bareilly", subdivisionCount: 3, consumerCount: 4010, reliabilityIndex: 0.91, flexibilityIndex: 0.68, fairnessIndex: 0.94 },
  { discom: "DVVNL", town: "Mathura", subdivisionCount: 2, consumerCount: 2540, reliabilityIndex: 0.83, flexibilityIndex: 0.61, fairnessIndex: 0.89 },
];

describe("titles.ts pure functions", () => {
  it("canDrillDown is false only for the regulator role", () => {
    expect(canDrillDown("regulator")).toBe(false);
    expect(canDrillDown("ae")).toBe(true);
    expect(canDrillDown(null)).toBe(true);
  });

  it("totalConsumers sums both DISCOM nodes", () => {
    expect(totalConsumers(nodes)).toBe(6550);
  });

  it("moneyshotTitle formats the average reliability", () => {
    expect(moneyshotTitle(nodes)).toBe("87.0% average reliability index across both DISCOMs");
  });
});

describe("RegulatorView", () => {
  it("renders both DISCOM node cards and the aggregates-only note from offline fixtures", async () => {
    render(
      <RoleProvider>
        <RegulatorView />
      </RoleProvider>,
    );
    expect(await screen.findByText("Regulator View")).toBeInTheDocument();
    expect(await screen.findByText(/Aggregates only/)).toBeInTheDocument();
    expect(screen.getAllByText(/MVVNL|DVVNL/).length).toBeGreaterThan(0);
  });
});
