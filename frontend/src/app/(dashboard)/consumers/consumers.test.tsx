import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { ConsumersView } from "./ConsumersView";
import { channelCounts, moneyshotTitle, openComplaintCount, outboxTitle } from "./titles";
import type { Complaint, ConsumerMessageRecord } from "@/lib/api/types";

const messages: ConsumerMessageRecord[] = [
  { id: "m1", consumerId: "c1", subdivisionId: "sd_subhashnagar", channel: "whatsapp", direction: "outbound", bodyHi: "a", bodyEn: "a", timestampIso: "2026-10-02T16:00:00+05:30", audioUrl: null },
  { id: "m2", consumerId: "c1", subdivisionId: "sd_subhashnagar", channel: "ivr", direction: "inbound", bodyHi: "b", bodyEn: "b", timestampIso: "2026-10-02T16:05:00+05:30", audioUrl: null },
];
const complaints: Complaint[] = [
  { id: "cmp1", consumerId: "c1", subdivisionId: "sd_subhashnagar", kind: "outage", status: "open", createdIso: "2026-10-02T19:00:00+05:30", message: "No power" },
];

describe("titles.ts pure functions", () => {
  it("channelCounts tallies every channel", () => {
    expect(channelCounts(messages)).toEqual({ whatsapp: 1, ivr: 1, sms: 0 });
  });

  it("openComplaintCount counts only open complaints", () => {
    expect(openComplaintCount(complaints)).toBe(1);
    expect(openComplaintCount([{ ...complaints[0], status: "resolved" }])).toBe(0);
  });

  it("outboxTitle and moneyshotTitle format counts", () => {
    expect(outboxTitle(2)).toBe("2 channel messages (WhatsApp/IVR/SMS)");
    expect(moneyshotTitle(1)).toBe("1 complaints still open");
  });
});

describe("ConsumersView", () => {
  it("renders the outbox, phone preview, and complaints from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <ConsumersView />
      </ScopeProvider>,
    );
    expect(await screen.findByText("Consumer preview")).toBeInTheDocument();
    expect(screen.getByText("Consumers & Channels")).toBeInTheDocument();
    expect(screen.getByText("Complaints")).toBeInTheDocument();
  });
});
