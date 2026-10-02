import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { MapConsoleView } from "./MapConsoleView";
import { consoleTitle, selectionTitle } from "./titles";

describe("titles.ts pure functions", () => {
  it("consoleTitle formats the counts", () => {
    expect(consoleTitle(3, 7)).toBe("3 transformers, 7 feeders in view");
  });

  it("selectionTitle handles no selection and a DT selection", () => {
    expect(selectionTitle(null, null)).toBe("No selection — click a feeder or DT");
    expect(selectionTitle("dt", "dt_sn_01")).toBe("Transformer dt_sn_01");
    expect(selectionTitle("feeder", "fdr_sn_a")).toBe("Feeder fdr_sn_a");
  });
});

describe("MapConsoleView", () => {
  it("renders layer toggles and the legend from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <MapConsoleView />
      </ScopeProvider>,
    );
expect(await screen.findByText("Grid Map")).toBeInTheDocument();
    expect(await screen.findByText("Service areas (Voronoi)")).toBeInTheDocument();
    expect(screen.getByText("No selection — click a feeder or DT")).toBeInTheDocument();
  });
});
