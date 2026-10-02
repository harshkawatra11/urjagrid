import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { SubdivisionDetailView } from "./SubdivisionDetailView";
import { feederBreakdownTitle, headlineFor, scorecardTitle } from "./titles";
import type { Subdivision } from "@/lib/api/types";

const sample: Subdivision = {
  id: "sd_krishnanagar",
  name: "Krishna Nagar",
  town: "Mathura",
  discom: "DVVNL",
  feederIds: ["fdr_kn_a", "fdr_kn_b"],
  riskLevel: "critical",
  riskIndex: 0.88,
  consumerCount: 1560,
  activePlanCount: 3,
  servedFraction: 0.84,
  center: { lat: 27.4924, lng: 77.6737 },
};

describe("titles.ts pure functions", () => {
  it("scorecardTitle / headlineFor / feederBreakdownTitle", () => {
    expect(scorecardTitle(sample)).toBe("Krishna Nagar scorecard");
    expect(headlineFor(sample)).toContain("critical risk");
    expect(feederBreakdownTitle(2)).toBe("2 feeders in this sub-division");
  });

  it("handles the not-found case", () => {
    expect(scorecardTitle(undefined)).toBe("Sub-division scorecard");
    expect(headlineFor(undefined)).toBe("Sub-division not found");
  });
});

describe("SubdivisionDetailView", () => {
  it("renders the scorecard for sd_krishnanagar from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <SubdivisionDetailView id="sd_krishnanagar" />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Krishna Nagar scorecard")).toBeInTheDocument();
    expect(screen.getByText("Print A4 scorecard")).toBeInTheDocument();
  });
});
