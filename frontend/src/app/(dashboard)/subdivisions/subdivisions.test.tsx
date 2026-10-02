import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { SubdivisionsView } from "./SubdivisionsView";
import { hourlyRiskMultiplier, moneyshotTitle, worstSubdivisionHeadline } from "./titles";
import type { Subdivision } from "@/lib/api/types";

describe("titles.ts pure functions", () => {
  it("moneyshotTitle formats the average served percentage", () => {
    expect(moneyshotTitle(91.234)).toBe("91.2% average served across 5 sub-divisions");
  });

  it("worstSubdivisionHeadline handles the empty case", () => {
    expect(worstSubdivisionHeadline(undefined)).toBe("No sub-division data available");
  });

  it("worstSubdivisionHeadline names the sub-division", () => {
    const s = { name: "Krishna Nagar" } as Subdivision;
    expect(worstSubdivisionHeadline(s)).toContain("Krishna Nagar");
  });

  it("hourlyRiskMultiplier stays within 0..1 and peaks in the evening", () => {
    const evening = hourlyRiskMultiplier(19, 0.8);
    const midday = hourlyRiskMultiplier(13, 0.8);
    expect(evening).toBeGreaterThan(midday);
    expect(evening).toBeLessThanOrEqual(1);
  });
});

describe("SubdivisionsView", () => {
  it("renders the moneyshot, matrix, and heatmap from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <SubdivisionsView />
      </ScopeProvider>,
    );
    // Query first for content unique to the loaded state (the title text alone is also present
    // in the loading skeleton, so resolving against it can race the skeleton -> loaded swap).
    expect(await screen.findByText(/average served across 5 sub-divisions/)).toBeInTheDocument();
    expect(screen.getByText("Sub-division Lab")).toBeInTheDocument();
    expect(screen.getByText(/Comparison matrix/)).toBeInTheDocument();
    expect(screen.getAllByText("Krishna Nagar").length).toBeGreaterThan(0);
  });
});
