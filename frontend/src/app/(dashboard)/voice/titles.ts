/** D2 Voice Control Room -- card/footer titles computed from live voice session state. */
import type { VoiceStatus } from "@/lib/voice/client";

export function connectionSummary(status: VoiceStatus, scopeLabel: string): string {
  if (status === "connected") return `Listening for ${scopeLabel}`;
  if (status === "connecting") return `Connecting to Urja for ${scopeLabel}...`;
  return `Urja unreachable -- showing text-only fallback for ${scopeLabel}`;
}
