import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/flex/lifeline" }));

import { ScopeProvider } from "@/lib/scope";
import { LifelineView } from "./LifelineView";

describe("LifelineView (D15 Lifeline and Fairness)", () => {
  it("renders the Jain index moneyshot, Lorenz curve, HES gauge, cap breakdown and guardrails checklist", async () => {
    render(
      <ScopeProvider>
        <LifelineView />
      </ScopeProvider>,
    );

    await waitFor(() => expect(screen.getByRole("group", { name: "Fairness Lorenz curve" })).toBeInTheDocument(), {
      timeout: 25_000,
    });

    expect(screen.getByText("Moneyshot -- Jain fairness index")).toBeInTheDocument();
    expect(screen.getByText("0.93")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "HES command success rate" })).toBeInTheDocument();
    expect(screen.getByText(/Cap-level breakdown/)).toBeInTheDocument();
    expect(screen.getByText(/safety invariants holding/)).toBeInTheDocument();
    expect(screen.getByText(/T0 critical facilities/)).toBeInTheDocument();
  });
});
