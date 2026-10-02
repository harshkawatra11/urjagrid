import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { CriticalView } from "./CriticalView";
import { backupCoveragePct, countsByKind, moneyshotTitle, registryTitle } from "./titles";
import type { CriticalFacility } from "@/lib/api/types";

const facilities: CriticalFacility[] = [
  { id: "f1", dtId: "dt_1", subdivisionId: "sd_subhashnagar", name: "PHC", kind: "hospital", backupAvailable: true },
  { id: "f2", dtId: "dt_1", subdivisionId: "sd_subhashnagar", name: "Home", kind: "life_support", backupAvailable: false },
];

describe("titles.ts pure functions", () => {
  it("backupCoveragePct computes the percentage with backup", () => {
    expect(backupCoveragePct(facilities)).toBe(50);
    expect(backupCoveragePct([])).toBe(0);
  });

  it("countsByKind tallies every kind", () => {
    expect(countsByKind(facilities)).toEqual({ hospital: 1, water: 0, telecom: 0, life_support: 1 });
  });

  it("registryTitle and moneyshotTitle format counts", () => {
    expect(registryTitle(2)).toBe("2 T0 critical facilities and life-support homes");
    expect(moneyshotTitle(50)).toBe("50% of critical loads have verified backup power");
  });
});

describe("CriticalView", () => {
  it("renders the registry table and coverage matrix from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <CriticalView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Coverage matrix")).toBeInTheDocument();
    expect(screen.getByText("Critical Loads")).toBeInTheDocument();
  });
});
