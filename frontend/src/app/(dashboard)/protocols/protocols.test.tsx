import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProtocolsView } from "./ProtocolsView";
import { moneyshotTitle, totalCount } from "./titles";

describe("titles.ts pure functions", () => {
  it("totalCount sums every protocol's count", () => {
    expect(totalCount({ hes: 10, ocpp: 5 })).toBe(15);
  });

  it("moneyshotTitle formats the total", () => {
    expect(moneyshotTitle(1234)).toBe("1,234 protocol messages exchanged (all WIRED simulators)");
  });
});

describe("ProtocolsView", () => {
  it("renders protocol cards and an expandable payload inspector from offline fixtures", async () => {
    render(<ProtocolsView />);
    expect(await screen.findByText("Integrations")).toBeInTheDocument();
    const inspectButtons = await screen.findAllByText("Inspect payload");
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);
    expect(screen.getByText("Hide payload")).toBeInTheDocument();
  });
});
