import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeterWall } from "./MeterWall";
import { SingleLineDiagram } from "./SingleLineDiagram";
import { LeverStack } from "./LeverStack";
import { PlanCard } from "./PlanCard";
import { OptionsTable } from "./OptionsTable";
import { DispatchStepper } from "./DispatchStepper";
import { DecisionBar } from "./DecisionBar";
import { WhatIfPanel } from "./WhatIfPanel";
import { SensitivityMatrix } from "./SensitivityMatrix";
import { EventTimeline } from "./EventTimeline";
import { ProtocolMessage } from "./ProtocolMessage";
import { SituationBanner } from "./SituationBanner";
import type { Consumer, DispatchStep, EventLogEntry, FlexPlan, PlanOption, ProtocolMessageRecord, SensitivityCell } from "@/lib/api/types";

const consumers: Consumer[] = [
  { id: "c_sn_01_0001", dtId: "dt_sn_01", subdivisionId: "sd_subhashnagar", tier: "T1", name: "House 1", meterState: "normal", capLevel: "none", connectedLoadW: 1200, lifelineHoursToday: 24, drOptedIn: true },
  { id: "c_sn_01_0002", dtId: "dt_sn_01", subdivisionId: "sd_subhashnagar", tier: "T1", name: "House 2", meterState: "capped", capLevel: "essential", connectedLoadW: 1500, lifelineHoursToday: 20, drOptedIn: false },
];

const plan: FlexPlan = {
  id: "fp_a1b2c3d4",
  subdivisionId: "sd_subhashnagar",
  dtIds: ["dt_sn_01"],
  status: "proposed",
  deficitWindowId: "dw_1",
  createdIso: "2026-10-02T14:30:00+05:30",
  windowStartIso: "2026-10-02T18:00:00+05:30",
  windowEndIso: "2026-10-02T20:00:00+05:30",
  gapKw: 80,
  coveredKw: 60,
  levers: [
    { lever: "behavioral_dr", reliefKw: 20, costRs: 1200, consumerCount: 150 },
    { lever: "lifeline_cap", reliefKw: 40, costRs: 0, consumerCount: 90 },
  ],
  approverName: null,
  approvedIso: null,
  notes: null,
};

describe("grid components render with sample data", () => {
  it("MeterWall", () => {
    render(<MeterWall consumers={consumers} />);
    expect(screen.getByRole("list", { name: "Meter wall" })).toBeInTheDocument();
  });

  it("SingleLineDiagram", () => {
    render(
      <SingleLineDiagram
        substation={{ id: "sub", label: "33/11kV" }}
        feeder={{ id: "fdr_sn_a", label: "Feeder A", riskLevel: "moderate" }}
        transformer={{ id: "dt_sn_01", label: "DT 01", riskLevel: "high" }}
        branches={[{ id: "c1", label: "LV1" }, { id: "c2", label: "LV2" }]}
      />,
    );
    expect(screen.getByRole("img", { name: "Single line diagram" })).toBeInTheDocument();
  });

  it("LeverStack", () => {
    render(<LeverStack levers={plan.levers} gapKw={plan.gapKw} />);
    expect(screen.getByText("L1 DR")).toBeInTheDocument();
  });

  it("PlanCard", () => {
    render(<PlanCard plan={plan} />);
    expect(screen.getByText("fp_a1b2c3d4")).toBeInTheDocument();
  });

  it("OptionsTable", () => {
    const options: PlanOption[] = [
      { id: "opt_1", label: "Optimiser", levers: plan.levers, totalReliefKw: 60, totalCostRs: 1200, unservedKw: 20, recommended: true },
    ];
    render(<OptionsTable options={options} />);
    expect(screen.getByText("Optimiser")).toBeInTheDocument();
  });

  it("DispatchStepper", () => {
    const steps: DispatchStep[] = [
      { key: "notify", label: "Notify", scheduledIso: "2026-10-02T16:00:00+05:30", completedIso: "2026-10-02T16:00:00+05:30", status: "done" },
      { key: "signal", label: "Signal", scheduledIso: "2026-10-02T17:30:00+05:30", completedIso: null, status: "pending" },
    ];
    render(<DispatchStepper steps={steps} />);
    expect(screen.getByRole("list", { name: "Dispatch timeline" })).toBeInTheDocument();
  });

  it("DecisionBar shows the approver gate for a non-approver role", () => {
    render(<DecisionBar status="proposed" role="consumer" onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/Only a Junior Engineer/)).toBeInTheDocument();
  });

  it("DecisionBar enables actions for a je role with a name entered", () => {
    render(<DecisionBar status="proposed" role="je" onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("WhatIfPanel", () => {
    render(<WhatIfPanel onSimulate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Run what-if" })).toBeInTheDocument();
  });

  it("SensitivityMatrix", () => {
    const cells: SensitivityCell[] = [{ leverDeltaPct: 0, gapDeltaPct: 0, unservedKw: 10 }];
    render(<SensitivityMatrix cells={cells} leverDeltas={[0]} gapDeltas={[0]} />);
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("EventTimeline", () => {
    const events: EventLogEntry[] = [
      { id: "e1", timestampIso: "2026-10-02T18:00:00+05:30", kind: "dispatch", subdivisionId: "sd_subhashnagar", dtId: "dt_sn_01", planId: "fp_1", message: "Dispatched plan" },
    ];
    render(<EventTimeline events={events} />);
    expect(screen.getByText("Dispatched plan")).toBeInTheDocument();
  });

  it("EventTimeline shows empty state", () => {
    render(<EventTimeline events={[]} />);
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("ProtocolMessage", () => {
    const message: ProtocolMessageRecord = {
      id: "m1",
      protocol: "hes",
      direction: "outbound",
      summary: "Set load limit 500W",
      payload: {},
      timestampIso: "2026-10-02T18:00:00+05:30",
      status: "acked",
    };
    render(<ProtocolMessage message={message} />);
    expect(screen.getByText("Set load limit 500W")).toBeInTheDocument();
    expect(screen.getByText("WIRED")).toBeInTheDocument();
  });

  it("SituationBanner", () => {
    render(<SituationBanner riskLevel="critical" headline="Krishna Nagar DT 01 overloaded" detail="134% loading" />);
    expect(screen.getByText("Krishna Nagar DT 01 overloaded")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });
});
