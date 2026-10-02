import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/plans/fp_a1b2c3d4",
  useParams: () => ({ planId: "fp_a1b2c3d4" }),
}));

import { RoleProvider } from "@/lib/roleContext";
import { ScopeProvider } from "@/lib/scope";
import { PlanDetailView } from "./PlanDetailView";

describe("PlanDetailView (D4 Flex Plan case file)", () => {
  it("renders the full case file from the plans__fp_a1b2c3d4 fixture", async () => {
    render(
      <ScopeProvider>
        <RoleProvider>
          <PlanDetailView />
        </RoleProvider>
      </ScopeProvider>,
    );

    await waitFor(() => expect(screen.getByRole("group", { name: "Lever relief waterfall" })).toBeInTheDocument(), {
      timeout: 25_000,
    });
    expect(screen.getByText(/candidate option/)).toBeInTheDocument();
    expect(screen.getByText("Optimiser (this plan)")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Dispatch timeline" })).toBeInTheDocument();
    expect(screen.getByText(/Approve \/ reject/)).toBeInTheDocument();
    expect(screen.getByText(/Protocol ledger/)).toBeInTheDocument();
    expect(screen.getAllByText(/households/).length).toBeGreaterThan(0);
  });
});
