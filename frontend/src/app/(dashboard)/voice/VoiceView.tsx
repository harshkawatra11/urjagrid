"use client";

import { VoiceSessionProvider } from "@/lib/voice/VoiceSessionProvider";
import { VoicePage } from "@/components/voice/VoicePage";

/**
 * D2 Voice Control Room route. Lane C built `VoicePage` + `Orb` + `ConversationPanel` +
 * `FactCard` already; the one thing missing for a real route is the session provider the
 * component's hooks (`useVoice`) need, which `DashboardShell` does not supply (voice is the only
 * page that needs a live WebSocket session, so it is scoped to this route instead of every page).
 */
export function VoiceView() {
  return (
    <VoiceSessionProvider>
      <VoicePage />
    </VoiceSessionProvider>
  );
}
