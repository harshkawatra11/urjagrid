import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ usePathname: () => "/scenario" }));

import { ScenarioView } from "./ScenarioView";

describe("ScenarioView (D22 Scenario Lab)", () => {
  it("renders the 4 presets and, after running one offline, shows the national-impact matrix from its fixture", async () => {
    const user = userEvent.setup();
    render(<ScenarioView />);

    expect(screen.getByText("Heatwave evening")).toBeInTheDocument();
    expect(screen.getByText("Monsoon cloud cover")).toBeInTheDocument();
    expect(screen.getByText("Solar noon")).toBeInTheDocument();
    expect(screen.getByText("RE 2047")).toBeInTheDocument();

    const runButtons = screen.getAllByRole("button", { name: "Run scenario" });
    await user.click(runButtons[0]);

    await waitFor(() => expect(screen.getByRole("grid", { name: "National-impact matrix" })).toBeInTheDocument(), {
      timeout: 25_000,
    });

    expect(screen.getByText(/kW of shedding avoided/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Relief fraction" })).toBeInTheDocument();
    expect(screen.getByText(/Run log \(1\)/)).toBeInTheDocument();
  });
});
