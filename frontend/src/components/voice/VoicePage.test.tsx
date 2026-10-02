import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/voice" }));

import { ScopeProvider } from "@/lib/scope";
import { VoiceSessionProvider } from "@/lib/voice/VoiceSessionProvider";
import { VoicePage } from "./VoicePage";

describe("VoicePage", () => {
  it("renders the orb, conversation panel and connection chip without a backend", () => {
    render(
      <ScopeProvider>
        <VoiceSessionProvider>
          <VoicePage />
        </VoiceSessionProvider>
      </ScopeProvider>,
    );
    expect(screen.getByRole("heading", { name: "Voice Control Room" })).toBeInTheDocument();
    expect(screen.getByTestId("connection-chip")).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
  });
});
