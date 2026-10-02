import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FactCard } from "./FactCard";
import type { FactCard as FactCardData } from "@/lib/voice/protocol";

const cards: FactCardData[] = [
  { type: "circle_summary", discom: "MVVNL", subdivisionCount: 3, riskCounts: { critical: 1, moderate: 2 }, servedFraction: 0.91 },
  { type: "subdivision", id: "sd_krishnanagar", name: "Krishna Nagar", riskLevel: "critical", riskIndex: 0.88, servedFraction: 0.84, activePlanCount: 3 },
  { type: "transformer", id: "dt_kn_01", name: "Krishna Nagar DT 01", loadingPu: 1.34, hotspotC: 121.8, riskLevel: "critical" },
  { type: "deficits", rows: [{ dtId: "dt_kn_01", dtName: "Krishna Nagar DT 01", gapKw: 86.5, startIso: "2026-10-02T18:00:00+05:30" }] },
  { type: "ranking", metric: "risk_index", unit: "", rows: [{ id: "sd_krishnanagar", name: "Krishna Nagar", value: 88 }] },
  { type: "plans", rows: [{ id: "fp_a1b2c3d4", subdivisionName: "Krishna Nagar", status: "proposed", gapKw: 86.5, coveredKw: 71.2 }] },
  { type: "plan", id: "fp_a1b2c3d4", status: "proposed", gapKw: 86.5, coveredKw: 71.2, levers: [{ lever: "behavioral_dr", reliefKw: 22 }] },
  { type: "levers", rows: [{ lever: "behavioral_dr", reliefKw: 22, costRs: 1320 }] },
  { type: "critical", rows: [{ id: "cf_1", name: "District Hospital", kind: "hospital", backupAvailable: true }] },
  { type: "reliability", saidiMinutes: 45, saifiCount: 1.2, lifelineAvailabilityPct: 98.5 },
  { type: "forecast", dtName: "Krishna Nagar DT 01", p50NextHourKw: 95, gapKw: 12 },
  { type: "fairness", jainIndex: 0.92, giniCoefficient: 0.18 },
];

describe("FactCard renders all 12 LifelineGrid card types", () => {
  for (const card of cards) {
    it(card.type, () => {
      render(<FactCard card={card} />);
      expect(screen.getByTestId("fact-card")).toBeInTheDocument();
    });
  }
});
