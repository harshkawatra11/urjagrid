import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { DrView } from "./DrView";
import { betaPdf, densityCurve, totalRebate, totalShifted } from "./titles";
import type { DrBelief, RebateLedgerEntry } from "@/lib/api/types";

describe("titles.ts Beta-Bernoulli math", () => {
  it("betaPdf is 0 outside (0,1) and positive inside", () => {
    expect(betaPdf(0, 2, 2)).toBe(0);
    expect(betaPdf(1, 2, 2)).toBe(0);
    expect(betaPdf(0.5, 2, 2)).toBeGreaterThan(0);
  });

  it("betaPdf peaks near alpha/(alpha+beta) for a concentrated belief", () => {
    const curve = densityCurve({ subdivisionId: "sd_subhashnagar", alpha: 62, beta: 18, acceptanceRateEstimate: 0.775, sampleCount: 80 });
    const peak = curve.reduce((best, c) => (c.density > best.density ? c : best), curve[0]);
    expect(peak.x).toBeGreaterThan(0.6);
    expect(peak.x).toBeLessThan(0.9);
  });

  it("totalRebate and totalShifted sum the ledger", () => {
    const ledger: RebateLedgerEntry[] = [
      { subdivisionId: "sd_subhashnagar", consumerCount: 10, kwhShifted: 5, totalRebateRs: 10 },
      { subdivisionId: "sd_izzatnagar", consumerCount: 5, kwhShifted: 2, totalRebateRs: 4 },
    ];
    expect(totalRebate(ledger)).toBe(14);
    expect(totalShifted(ledger)).toBe(7);
  });
});

describe("DrView", () => {
  it("renders the belief density chart and rebate ledger from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <DrView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Demand Response")).toBeInTheDocument();
    expect(await screen.findByText("Rebate ledger")).toBeInTheDocument();
  });
});
