import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { connectionSummary } from "./titles";

vi.mock("next/navigation", () => ({ usePathname: () => "/voice" }));

import { ScopeProvider } from "@/lib/scope";
import { VoiceView } from "./VoiceView";

describe("VoiceView (D2 Voice Control Room)", () => {
  it("renders the orb, conversation panel and connection chip without a backend", () => {
    render(
      <ScopeProvider>
        <VoiceView />
      </ScopeProvider>,
    );
    expect(screen.getByRole("heading", { name: "Voice Control Room" })).toBeInTheDocument();
    expect(screen.getByTestId("connection-chip")).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
  });

  it("titles.connectionSummary phrases each voice-session status for the active scope", () => {
    expect(connectionSummary("connected", "All sub-divisions")).toBe("Listening for All sub-divisions");
    expect(connectionSummary("connecting", "Krishna Nagar")).toBe("Connecting to Urja for Krishna Nagar...");
    expect(connectionSummary("failed", "Krishna Nagar")).toBe("Urja unreachable -- showing text-only fallback for Krishna Nagar");
  });
});
