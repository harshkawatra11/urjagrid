import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { AnalyticsView } from "./AnalyticsView";
import { actionCounts, auditTitle, moneyshotTitle, roleCounts } from "./titles";
import type { AuditLogEntry } from "@/lib/api/types";

const entries: AuditLogEntry[] = [
  { id: "a1", timestampIso: "2026-10-02T20:00:00+05:30", actorName: "JE Singh", actorRole: "je", action: "approve", targetType: "FlexPlan", targetId: "fp_1" },
  { id: "a2", timestampIso: "2026-10-02T19:00:00+05:30", actorName: "AE Gupta", actorRole: "ae", action: "approve", targetType: "FlexPlan", targetId: "fp_2" },
];

describe("titles.ts pure functions", () => {
  it("actionCounts and roleCounts tally entries", () => {
    expect(actionCounts(entries)).toEqual({ approve: 2 });
    expect(roleCounts(entries)).toEqual({ je: 1, ae: 1 });
  });

  it("auditTitle and moneyshotTitle format counts", () => {
    expect(auditTitle(2)).toBe("2 audit log entries");
    expect(moneyshotTitle(2)).toBe("2 audited actions logged");
  });
});

describe("AnalyticsView", () => {
  it("renders the audit log and role matrix from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <AnalyticsView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Analytics")).toBeInTheDocument();
    expect(await screen.findByText("Role / permission matrix")).toBeInTheDocument();
  });
});
