import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { ForecastStudioView } from "./ForecastStudioView";
import { coverageStatus, importanceTitle, moneyshotTitle } from "./titles";
import type { ForecastBacktest } from "@/lib/api/types";

const backtest: ForecastBacktest = { wapePct: 8.4, skillScore: 0.37, coveragePct: 79.6, targetCoveragePct: 80 };

describe("titles.ts pure functions", () => {
  it("moneyshotTitle formats WAPE and skill score", () => {
    expect(moneyshotTitle(backtest)).toBe("8.4% WAPE, skill score 0.37");
  });

  it("moneyshotTitle handles missing backtest", () => {
    expect(moneyshotTitle(null)).toBe("Backtest not available");
  });

  it("coverageStatus reads close-to-target as on-target", () => {
    expect(coverageStatus(backtest)).toBe("on-target");
    expect(coverageStatus({ ...backtest, coveragePct: 60 })).toBe("under");
    expect(coverageStatus({ ...backtest, coveragePct: 95 })).toBe("over");
  });

  it("importanceTitle counts features", () => {
    expect(importanceTitle(13)).toBe("13 forecast features ranked by importance");
  });
});

describe("ForecastStudioView", () => {
  it("renders the fan chart, backtest KPIs, and feature importance from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <ForecastStudioView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Forecast Studio")).toBeInTheDocument();
    expect(await screen.findByText(/forecast features ranked by importance/)).toBeInTheDocument();
    expect(screen.getByText("Forecast quantile matrix")).toBeInTheDocument();
  });
});
