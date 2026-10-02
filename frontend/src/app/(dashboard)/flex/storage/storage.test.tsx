import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { StorageView } from "./StorageView";
import { avgSoc, fleetTitle, tradeValueRs, tradeVolumeKwh } from "./titles";
import type { P2pTrade, StorageAsset } from "@/lib/api/types";

const assets: StorageAsset[] = [
  { id: "s1", dtId: "dt_sn_01", subdivisionId: "sd_subhashnagar", name: "Battery 1", socPct: 60, dispatchKw: 10, capacityKwh: 100 },
  { id: "s2", dtId: "dt_kn_01", subdivisionId: "sd_krishnanagar", name: "Battery 2", socPct: 40, dispatchKw: 20, capacityKwh: 150 },
];
const trades: P2pTrade[] = [
  { id: "t1", sellerId: "c1", buyerId: "c2", subdivisionId: "sd_subhashnagar", energyKwh: 2, priceRs: 0.5, timestampIso: "2026-10-02T19:00:00+05:30", protocol: "beckn", status: "confirmed" },
];

describe("titles.ts pure functions", () => {
  it("fleetTitle counts storage assets", () => {
    expect(fleetTitle(2)).toBe("2 community storage assets dispatching");
  });

  it("avgSoc averages socPct", () => {
    expect(avgSoc(assets)).toBe(50);
  });

  it("tradeVolumeKwh and tradeValueRs sum trades", () => {
    expect(tradeVolumeKwh(trades)).toBe(2);
    expect(tradeValueRs(trades)).toBe(1);
  });
});

describe("StorageView", () => {
  it("renders the fleet table and trade ledger from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <StorageView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Storage & P2P")).toBeInTheDocument();
    expect(await screen.findByText("P2P trade ledger")).toBeInTheDocument();
  });
});
