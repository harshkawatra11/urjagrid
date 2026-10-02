import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScopeProvider } from "@/lib/scope";
import { ConsumerAppView } from "./ConsumerAppView";
import { availableHoursCount, lifelineGuaranteeLine, shedHoursCount, weatherHeadline } from "./titles";
import type { ConsumerStatus } from "@/lib/api/types";

const status: ConsumerStatus = {
  consumerId: "c_sn_01_0007",
  name: "Priya Sharma",
  subdivisionId: "sd_subhashnagar",
  tier: "T1",
  meterState: "dr",
  lifelineGuaranteeW: 300,
  availabilityBlocks: ["available", "available", "shed", "lifeline"],
  drAsk: null,
};

describe("titles.ts pure Hindi copy functions", () => {
  it("weatherHeadline includes the meter-state label in Hindi", () => {
    expect(weatherHeadline(status)).toContain("डिमांड रेस्पॉन्स सक्रिय");
  });

  it("lifelineGuaranteeLine includes the wattage", () => {
    expect(lifelineGuaranteeLine(300)).toContain("300");
  });

  it("availableHoursCount / shedHoursCount count the right blocks", () => {
    expect(availableHoursCount(status.availabilityBlocks)).toBe(2);
    expect(shedHoursCount(status.availabilityBlocks)).toBe(1);
  });
});

describe("ConsumerAppView", () => {
  it("renders the status card, availability blocks, and Ask Urja box from offline fixtures", async () => {
    render(
      <ScopeProvider>
        <ConsumerAppView />
      </ScopeProvider>,
    );
    expect(await screen.findByText(/नमस्ते/)).toBeInTheDocument();
    expect(await screen.findByText("आज के 24 घंटे")).toBeInTheDocument();
    expect(screen.getByText("ऊर्जा से पूछें")).toBeInTheDocument();
    expect(screen.getByText("बिजली गई? यहां दर्ज करें")).toBeInTheDocument();
  });

  it("lets the consumer accept the DR ask", async () => {
    render(
      <ScopeProvider>
        <ConsumerAppView />
      </ScopeProvider>,
    );
    const acceptButton = await screen.findByText("स्वीकार करें");
    fireEvent.click(acceptButton);
    expect(screen.getByText("आपने स्वीकार कर लिया है, धन्यवाद!")).toBeInTheDocument();
  });
});
