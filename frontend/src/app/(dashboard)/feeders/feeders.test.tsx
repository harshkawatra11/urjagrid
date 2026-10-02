import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { FeedersView } from "./FeedersView";
import { baselineOffHours, boardTitle, hourlyTrack, solutionOffHours } from "./titles";
import type { Feeder } from "@/lib/api/types";

const calm: Feeder = { id: "fdr_fp_a", subdivisionId: "sd_faridpur", name: "Faridpur Feeder A", voltageKv: 11, dtIds: [], loadingPu: 0.52, riskLevel: "low", path: [] };
const critical: Feeder = { id: "fdr_kn_a", subdivisionId: "sd_krishnanagar", name: "Krishna Nagar Feeder A", voltageKv: 11, dtIds: ["dt_kn_01"], loadingPu: 1.28, riskLevel: "critical", path: [] };

describe("titles.ts pure functions", () => {
  it("boardTitle counts the feeders", () => {
    expect(boardTitle(7)).toBe("7 feeders on the board");
  });

  it("solutionOffHours only sheds above the 1.3pu trip threshold", () => {
    expect(solutionOffHours(calm)).toBe(0);
    expect(solutionOffHours({ ...critical, loadingPu: 1.31 })).toBe(1);
  });

  it("baselineOffHours scales rotational shedding with risk level", () => {
    expect(baselineOffHours(calm)).toBe(0);
    expect(baselineOffHours(critical)).toBe(6);
  });

  it("hourlyTrack marks the evening-peak hours as shed", () => {
    const track = hourlyTrack(2);
    expect(track[18]).toBe("shed");
    expect(track[19]).toBe("shed");
    expect(track[20]).toBe("on");
    expect(track[0]).toBe("on");
  });
});

describe("FeedersView", () => {
  it("renders the on/off strip and feeder table from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <FeedersView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Feeders")).toBeInTheDocument();
    expect(await screen.findByText("On/off strip (24h)")).toBeInTheDocument();
    expect(screen.getAllByText(/Krishna Nagar Feeder A/).length).toBeGreaterThan(0);
  });
});
