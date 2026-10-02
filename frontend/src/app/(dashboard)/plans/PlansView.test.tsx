import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/plans" }));

import { ScopeProvider } from "@/lib/scope";
import { PlansView } from "./PlansView";

describe("PlansView (D3 Flex Plans decision desk)", () => {
  it("renders the Kanban board, what-if strip, funnel, gauge, gantt heatmap and decision log from fixtures", async () => {
    render(
      <ScopeProvider>
        <PlansView />
      </ScopeProvider>,
    );

    await waitFor(() => expect(screen.getAllByText("fp_a1b2c3d4").length).toBeGreaterThan(0), { timeout: 25_000 });

    expect(screen.getByText(/Awaiting \(/)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled \(/)).toBeInTheDocument();
    expect(screen.getByText(/Active \(/)).toBeInTheDocument();
    expect(screen.getByText(/Verified \(/)).toBeInTheDocument();
    expect(screen.getByText(/Rejected \(/)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Run what-if" })).toBeInTheDocument();
    expect(screen.getByText(/Approval funnel/)).toBeInTheDocument();
    expect(screen.getByText(/of proposed plans approved/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Deficit windows by hour" })).toBeInTheDocument();
    expect(screen.getByText(/Decision log/)).toBeInTheDocument();
  });
});
